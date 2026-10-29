import 'reflect-metadata';
import {
  Body,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Req,
  Res,
  Inject,
  Module,
  SetMetadata,
  UnauthorizedException,
  ForbiddenException,
  ParseUUIDPipe,
  type CanActivate,
  type ExecutionContext,
  type ArgumentsHost,
  Catch,
  HttpException,
  type ExceptionFilter,
} from '@nestjs/common';
import { NestFactory, Reflector } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder, ApiTags, ApiBody } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { ZodError, z } from 'zod';
import { QueryFailedError } from 'typeorm';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Database } from './database';
import { AuthService, type SessionUser } from './auth';
import { CareService } from './care';
import { PaymentService } from './payments';
import { ExtrasService } from './extras';
import { OperationsService } from './operations';
import { production, demo, origin, root } from './config';
const Public = () => SetMetadata('public', true);
type AppRequest = Request & { user?: SessionUser; rawBody?: Buffer };
const user = (req: AppRequest) => {
  if (!req.user) throw new UnauthorizedException();
  return req.user;
};
const page = (v: unknown) => z.coerce.number().int().min(1).max(100000).default(1).parse(v);
class AccessGuard implements CanActivate {
  constructor(
    private auth: AuthService,
    private reflector: Reflector,
  ) {}
  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<AppRequest>();
    if (
      !['GET', 'HEAD', 'OPTIONS'].includes(req.method) &&
      req.headers.origin &&
      req.headers.origin !== origin
    )
      throw new ForbiddenException('Origine non autorisée.');
    if (this.reflector.getAllAndOverride<boolean>('public', [context.getHandler(), context.getClass()]))
      return true;
    const bearer = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null;
    const cookie = (req.cookies as Record<string, string> | undefined)?.sos_session;
    const token = bearer ?? cookie;
    if (!token) throw new UnauthorizedException('Connecte-toi pour continuer.');
    req.user = await this.auth.authenticate(token);
    if (!bearer && !['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      if (req.headers.origin !== origin || req.headers['x-csrf-token'] !== req.user.csrf)
        throw new ForbiddenException('Vérification de sécurité échouée. Recharge la page.');
    }
    return true;
  }
}
@Catch()
class ApiErrors implements ExceptionFilter {
  catch(error: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    if (error instanceof ZodError) {
      res.status(400).json({
        message: 'Vérifie les champs du formulaire.',
        errors: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      });
      return;
    }
    if (error instanceof HttpException) {
      res.status(error.getStatus()).json({ message: error.message });
      return;
    }
    if (error instanceof QueryFailedError) {
      const code = (error.driverError as { code?: string }).code;
      if (['23505', '23P01', '40001', '40P01'].includes(code ?? '')) {
        res.status(409).json({ message: 'Conflit avec une opération existante. Recharge puis réessaie.' });
        return;
      }
    }
    console.error('API error', error instanceof Error ? error.name : 'UnknownError');
    res.status(500).json({ message: 'Une erreur est survenue. Réessaie ou contacte le support.' });
  }
}
@ApiTags('SOS DOCTEURS')
@Controller()
class ApiController {
  constructor(
    @Inject(AuthService) private auth: AuthService,
    @Inject(CareService) private care: CareService,
    @Inject(PaymentService) private payments: PaymentService,
    @Inject(ExtrasService) private extras: ExtrasService,
    @Inject(OperationsService) private operations: OperationsService,
  ) {}
  private session(req: AppRequest, res: Response, result: Awaited<ReturnType<AuthService['login']>>) {
    res.cookie('sos_session', result.token, {
      httpOnly: true,
      secure: production,
      sameSite: 'strict',
      path: '/api',
      maxAge: 8 * 3600000,
    });
    return {
      user: result.user,
      csrf: result.csrf,
      expiresAt: result.expiresAt,
      ...(req.headers['x-client'] === 'mobile' ? { token: result.token } : {}),
    };
  }
  @Public() @Get('health') health() {
    return { ok: true, service: 'sos-docteurs-api' };
  }
  @Public() @Get('config') config() {
    return {
      demo,
      payments: process.env.PAYMENT_MODE ?? 'disabled',
      video: !!process.env.DAILY_API_KEY,
      ai: process.env.AI_ENABLED === 'true' && !!process.env.OPENAI_API_KEY,
      maps: this.extras.db.geo
        ? 'PostGIS + OpenStreetMap'
        : 'OpenStreetMap (distance locale de développement)',
    };
  }
  @Public() @Get('services') services() {
    return this.care.services();
  }
  @Public() @Get('zones') zones() {
    return this.extras.zones();
  }
  @Public()
  @Post('auth/register')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name', 'email', 'password', 'phone', 'consent'],
      properties: {
        name: { type: 'string' },
        email: { type: 'string', format: 'email' },
        password: { type: 'string', minLength: 12 },
        phone: { type: 'string', example: '+2290190000000' },
        role: { type: 'string', enum: ['client', 'doctor', 'nurse'] },
        consent: { type: 'boolean', enum: [true] },
      },
    },
  })
  async register(@Req() r: AppRequest, @Res({ passthrough: true }) s: Response, @Body() b: unknown) {
    return this.session(r, s, await this.auth.register(b));
  }
  @Public()
  @Post('auth/login')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email', 'password'],
      properties: { email: { type: 'string', format: 'email' }, password: { type: 'string' } },
    },
  })
  async login(@Req() r: AppRequest, @Res({ passthrough: true }) s: Response, @Body() b: unknown) {
    return this.session(r, s, await this.auth.login(b));
  }
  @Get('auth/me') me(@Req() r: AppRequest) {
    return { user: user(r), csrf: user(r).csrf };
  }
  @Post('auth/logout') async logout(@Req() r: AppRequest, @Res({ passthrough: true }) s: Response) {
    const result = await this.auth.logout(user(r));
    s.clearCookie('sos_session', { path: '/api', httpOnly: true, secure: production, sameSite: 'strict' });
    return result;
  }
  @Post('auth/refresh') async refresh(@Req() r: AppRequest, @Res({ passthrough: true }) s: Response) {
    return this.session(r, s, await this.auth.rotate(user(r)));
  }
  @Get('auth/sessions') sessions(@Req() r: AppRequest) {
    return this.auth.sessions(user(r));
  }
  @Delete('auth/sessions/:id') revoke(@Req() r: AppRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.auth.revoke(user(r), id);
  }
  @Public() @Post('auth/forgot') forgot(@Body() b: unknown) {
    return this.auth.forgot(b);
  }
  @Public() @Post('auth/reset') reset(@Body() b: unknown) {
    return this.auth.reset(b);
  }
  @Get('beneficiaries') beneficiaries(@Req() r: AppRequest) {
    return this.care.beneficiaries(user(r));
  }
  @Post('beneficiaries') addBeneficiary(@Req() r: AppRequest, @Body() b: unknown) {
    return this.care.addBeneficiary(user(r), b);
  }
  @Get('cares') cares(@Req() r: AppRequest, @Query('page') p: unknown) {
    return this.care.list(user(r), page(p));
  }
  @Post('cares')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['serviceId', 'description', 'address', 'zone', 'startAt', 'consent'],
      properties: {
        serviceId: { type: 'string', format: 'uuid' },
        beneficiaryId: { type: 'string', format: 'uuid', nullable: true },
        description: { type: 'string', minLength: 5, maxLength: 2000 },
        address: { type: 'string', minLength: 5 },
        zone: { type: 'string' },
        startAt: { type: 'string', format: 'date-time' },
        urgent: { type: 'boolean' },
        consent: { type: 'boolean', enum: [true] },
      },
    },
  })
  create(@Req() r: AppRequest, @Body() b: unknown) {
    return this.care.create(user(r), b);
  }
  @Get('cares/:id') detail(@Req() r: AppRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.care.detail(user(r), id);
  }
  @Post('cares/:id/transition') transition(
    @Req() r: AppRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() b: unknown,
  ) {
    return this.care.transition(user(r), id, b);
  }
  @Post('cares/:id/quote') quote(
    @Req() r: AppRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() b: unknown,
  ) {
    return this.care.setQuote(user(r), id, b);
  }
  @Get('cares/:id/candidates') candidates(
    @Req() r: AppRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.care.candidates(user(r), id);
  }
  @Post('cares/:id/assign') assign(
    @Req() r: AppRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() b: unknown,
  ) {
    return this.care.assign(user(r), id, b);
  }
  @Get('cares/:id/notes') notes(@Req() r: AppRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.care.notes(user(r), id);
  }
  @Post('cares/:id/notes') addNote(
    @Req() r: AppRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() b: unknown,
  ) {
    return this.care.addNote(user(r), id, b);
  }
  @Post('cares/:id/consultation') consultation(
    @Req() r: AppRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() b: unknown,
  ) {
    return this.extras.consultation(user(r), id, b);
  }
  @Get('professional/profile') profile(@Req() r: AppRequest) {
    return this.care.profile(user(r));
  }
  @Patch('professional/profile') updateProfile(@Req() r: AppRequest, @Body() b: unknown) {
    return this.care.updateProfile(user(r), b);
  }
  @Get('professional/availability') availability(@Req() r: AppRequest) {
    return this.care.availability(user(r));
  }
  @Post('professional/availability') addAvailability(@Req() r: AppRequest, @Body() b: unknown) {
    return this.care.addAvailability(user(r), b);
  }
  @Get('professionals') professionals(@Req() r: AppRequest) {
    return this.care.professionals(user(r));
  }
  @Post('professionals/:id/verify') verify(
    @Req() r: AppRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() b: unknown,
  ) {
    return this.care.verify(user(r), id, b);
  }
  @Get('documents') documents(@Req() r: AppRequest, @Query('userId') id?: string) {
    if (id) z.uuid().parse(id);
    return this.extras.documents(user(r), id);
  }
  @Post('documents') upload(@Req() r: AppRequest, @Body() b: unknown) {
    return this.extras.upload(user(r), b);
  }
  @Get('documents/:id/content') async download(
    @Req() r: AppRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Res() s: Response,
  ) {
    const d = await this.extras.download(user(r), id);
    s.setHeader('Content-Type', d.mime);
    s.setHeader('Content-Disposition', "attachment; filename*=UTF-8''" + encodeURIComponent(d.name));
    s.setHeader('Cache-Control', 'no-store');
    s.send(d.bytes);
  }
  @Get('invoices') invoices(@Req() r: AppRequest) {
    return this.payments.invoices(user(r));
  }
  @Get('payments') paymentsList(@Req() r: AppRequest) {
    return this.payments.list(user(r));
  }
  @Post('invoices/:id/pay')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['provider', 'phone'],
      properties: {
        provider: { type: 'string', enum: ['mtn', 'moov', 'celtiis'] },
        phone: { type: 'string' },
      },
    },
  })
  pay(@Req() r: AppRequest, @Param('id', new ParseUUIDPipe()) id: string, @Body() b: unknown) {
    return this.payments.start(user(r), id, String(r.headers['idempotency-key'] ?? ''), b);
  }
  @Post('payments/:id/reconcile') reconcile(
    @Req() r: AppRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
  ) {
    return this.payments.reconcile(user(r), id);
  }
  @Post('payments/:id/simulate') simulate(
    @Req() r: AppRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() b: unknown,
  ) {
    return this.payments.simulate(user(r), id, b);
  }
  @Post('payments/:id/refund') refund(
    @Req() r: AppRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() b: unknown,
  ) {
    return this.payments.refund(user(r), id, b);
  }
  @Public() @Post('webhooks/fedapay') webhook(@Req() r: AppRequest) {
    return this.payments.webhook(
      r.rawBody ?? Buffer.alloc(0),
      String(r.headers['x-fedapay-signature'] ?? ''),
    );
  }
  @Get('notifications') notifications(@Req() r: AppRequest) {
    return this.extras.notifications(user(r));
  }
  @Patch('notifications/:id/read') read(@Req() r: AppRequest, @Param('id', new ParseUUIDPipe()) id: string) {
    return this.extras.readNotification(user(r), id);
  }
  @Post('notifications/dispatch') dispatch(@Req() r: AppRequest) {
    return this.extras.dispatch(user(r));
  }
  @Get('preferences') preferences(@Req() r: AppRequest) {
    return this.extras.preferences(user(r));
  }
  @Patch('preferences') setPreferences(@Req() r: AppRequest, @Body() b: unknown) {
    return this.extras.setPreferences(user(r), b);
  }
  @Get('tickets') tickets(@Req() r: AppRequest) {
    return this.extras.tickets(user(r));
  }
  @Post('tickets') ticket(@Req() r: AppRequest, @Body() b: unknown) {
    return this.extras.ticket(user(r), b);
  }
  @Patch('tickets/:id') reply(
    @Req() r: AppRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() b: unknown,
  ) {
    return this.extras.reply(user(r), id, b);
  }
  @Post('assistant') assistant(@Req() r: AppRequest, @Body() b: unknown) {
    return this.extras.assistant(user(r), b);
  }
  @Get('admin/users') users(@Req() r: AppRequest) {
    return this.extras.users(user(r));
  }
  @Patch('admin/users/:id') suspend(
    @Req() r: AppRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() b: unknown,
  ) {
    return this.auth.suspend(user(r), id, b);
  }
  @Get('admin/audit') audit(@Req() r: AppRequest, @Query('page') p: unknown) {
    return this.extras.audits(user(r), page(p));
  }
  @Get('admin/services') allServices(@Req() r: AppRequest) {
    this.auth.require(user(r), ['admin']);
    return this.extras.db.repo('services').find({ order: { name: 'ASC' } });
  }
  @Patch('admin/services/:id') updateService(
    @Req() r: AppRequest,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() b: unknown,
  ) {
    return this.care.updateService(user(r), id, b);
  }
  @Post('admin/zones') zone(@Req() r: AppRequest, @Body() b: unknown) {
    return this.extras.setZone(user(r), b);
  }
  @Get('operations/settings') settings(@Req() r: AppRequest) {
    return this.operations.settings(user(r));
  }
  @Patch('operations/settings') setSettings(@Req() r: AppRequest, @Body() b: unknown) {
    return this.operations.updateSettings(user(r), b);
  }
  @Post('operations/release-expired') release(@Req() r: AppRequest) {
    return this.operations.releaseExpired(user(r));
  }
  @Post('professional/availability/weekly') weekly(@Req() r: AppRequest, @Body() b: unknown) {
    return this.operations.weekly(user(r), b);
  }
  @Get('professional/earnings') earnings(@Req() r: AppRequest) {
    return this.operations.earnings(user(r));
  }
  @Get('privacy/export') exportPersonal(@Req() r: AppRequest) {
    return this.operations.exportPersonal(user(r));
  }
  @Post('admin/services') createService(@Req() r: AppRequest, @Body() b: unknown) {
    return this.operations.createService(user(r), b);
  }
}
export async function createApp(db: Database, options: { log?: boolean; exportOpenApi?: boolean } = {}) {
  const auth = new AuthService(db),
    care = new CareService(db, auth),
    payments = new PaymentService(db, auth),
    extras = new ExtrasService(db, auth, care),
    operations = new OperationsService(db, auth, care);
  @Module({
    controllers: [ApiController],
    providers: [
      { provide: AuthService, useValue: auth },
      { provide: CareService, useValue: care },
      { provide: PaymentService, useValue: payments },
      { provide: ExtrasService, useValue: extras },
      { provide: OperationsService, useValue: operations },
    ],
  })
  class AppModule {}
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: options.log ? ['log', 'error', 'warn'] : false,
    rawBody: true,
    bodyParser: true,
  });
  app.getHttpAdapter().getInstance().set('trust proxy', false);
  app.use(helmet());
  app.use(cookieParser());
  app.use('/api', (_req: Request, res: Response, next: () => void) => {
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.use(
    rateLimit({
      windowMs: 60000,
      limit: 180,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { message: 'Trop de requêtes. Réessaie dans une minute.' },
    }),
  );
  app.use(
    '/api/auth',
    rateLimit({
      windowMs: 15 * 60000,
      limit: 40,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      message: { message: 'Trop de tentatives. Réessaie plus tard.' },
    }),
  );
  app.use(
    '/api/assistant',
    rateLimit({ windowMs: 60000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false }),
  );
  app.useBodyParser('json', { limit: '8mb' });
  app.enableCors({
    origin,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Client', 'Idempotency-Key'],
  });
  app.setGlobalPrefix('api');
  app.useGlobalGuards(new AccessGuard(auth, new Reflector()));
  app.useGlobalFilters(new ApiErrors());
  const spec = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('SOS DOCTEURS')
      .setVersion('0.1.0')
      .setDescription(
        'API française. Session cookie + X-CSRF-Token pour le web ; token opaque Bearer pour Android. Identifiants UUID. Les routes vérifient les droits serveur.',
      )
      .addBearerAuth()
      .addCookieAuth('sos_session')
      .build(),
  );
  if (!production) SwaggerModule.setup('api/docs', app, spec);
  if (options.exportOpenApi) writeFileSync(resolve(root, 'docs/openapi.json'), JSON.stringify(spec, null, 2));
  await app.init();
  return { app, auth, care, payments, extras, operations };
}
