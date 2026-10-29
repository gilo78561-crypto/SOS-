import {
  Text,
  View,
  Pressable,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  type TextInputProps,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps, ReactNode } from 'react';
export const colors = {
  primary: '#006B45',
  ink: '#172C25',
  muted: '#53675F',
  bg: '#F5F8F6',
  soft: '#E6F3EB',
  border: '#DCE5DF',
  red: '#B42332',
  white: '#FFFFFF',
};
export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];
export function Icon({
  name,
  size = 24,
  color = colors.primary,
}: {
  name: IconName;
  size?: number;
  color?: string;
}) {
  return <MaterialCommunityIcons name={name} size={size} color={color} />;
}
export function Button({
  title,
  onPress,
  outline = false,
  disabled = false,
  icon,
}: {
  title: string;
  onPress: () => void;
  outline?: boolean;
  disabled?: boolean;
  icon?: IconName;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      android_ripple={{ color: outline ? '#CCDCD1' : '#268762' }}
      style={({ pressed }) => [
        s.button,
        outline && s.buttonOutline,
        pressed && { opacity: 0.8 },
        disabled && { opacity: 0.55 },
      ]}
    >
      <Text style={[s.buttonText, outline && { color: colors.primary }]}>{title}</Text>
      {icon && <Icon name={icon} size={19} color={outline ? colors.primary : '#FFF'} />}
    </Pressable>
  );
}
export function Field({ label, hint, ...props }: TextInputProps & { label: string; hint?: string }) {
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#718478"
        style={[s.input, props.multiline && { minHeight: 105, textAlignVertical: 'top' }]}
        {...props}
      />
      {hint && <Text style={s.caption}>{hint}</Text>}
    </View>
  );
}
export function Card({ children }: { children: ReactNode }) {
  return <View style={s.card}>{children}</View>;
}
export function Notice({ text, error = false }: { text: string; error?: boolean }) {
  return (
    <View
      accessibilityLiveRegion="polite"
      style={[s.notice, error && { backgroundColor: '#FFF0F1', borderColor: '#F0CDD1' }]}
    >
      <Text style={[s.noticeText, error && { color: colors.red }]}>{text}</Text>
    </View>
  );
}
export function Heading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View style={{ marginBottom: 22 }}>
      <Text style={s.eyebrow}>VOTRE SANTÉ, NOTRE MISSION</Text>
      <Text accessibilityRole="header" style={s.h1}>
        {title}
      </Text>
      {subtitle && <Text style={s.body}>{subtitle}</Text>}
    </View>
  );
}
export function Empty({ title, text }: { title: string; text: string }) {
  return (
    <View style={s.empty}>
      <View style={s.iconTile}>
        <Icon name="stethoscope" size={30} />
      </View>
      <Text style={s.h3}>{title}</Text>
      <Text style={[s.body, { textAlign: 'center' }]}>{text}</Text>
    </View>
  );
}
export function Busy() {
  return (
    <View style={s.empty}>
      <ActivityIndicator color={colors.primary} />
      <Text style={s.caption}>Chargement…</Text>
    </View>
  );
}
export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: 22, paddingBottom: 35 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandTitle: { fontSize: 17, fontWeight: '800', color: colors.primary },
  brandCaption: { fontSize: 8, letterSpacing: 1.3, color: colors.muted, marginTop: 3 },
  eyebrow: { fontSize: 10, letterSpacing: 1.8, fontWeight: '700', color: colors.primary, marginBottom: 12 },
  h1: { fontSize: 30, fontWeight: '700', letterSpacing: -1, color: colors.ink, marginBottom: 10 },
  h2: { fontSize: 23, fontWeight: '700', letterSpacing: -0.6, color: colors.ink, marginBottom: 12 },
  h3: { fontSize: 17, fontWeight: '700', color: colors.ink, marginBottom: 8 },
  body: { fontSize: 15, lineHeight: 23, color: colors.muted },
  caption: { fontSize: 12, lineHeight: 19, color: colors.muted },
  label: { fontSize: 13, fontWeight: '600', color: colors.ink },
  field: { marginBottom: 18, gap: 8 },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#C8D6CD',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    minHeight: 50,
    color: colors.ink,
    fontSize: 16,
  },
  button: {
    minHeight: 50,
    backgroundColor: colors.primary,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 13,
    gap: 12,
    marginVertical: 5,
  },
  buttonOutline: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.border },
  buttonText: { color: '#FFF', fontWeight: '600', fontSize: 14 },
  card: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 16,
    padding: 20,
    marginBottom: 18,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  iconTile: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.soft,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notice: {
    backgroundColor: '#FFF8E8',
    borderWidth: 1,
    borderColor: '#EADAB3',
    borderRadius: 10,
    padding: 14,
    marginBottom: 16,
  },
  noticeText: { fontSize: 13, color: '#72500E', lineHeight: 20 },
  empty: { paddingVertical: 32, paddingHorizontal: 10, alignItems: 'center', gap: 14 },
  pill: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    backgroundColor: colors.soft,
    borderRadius: 7,
    alignSelf: 'flex-start',
  },
  pillText: { fontSize: 11, color: colors.primary, fontWeight: '600' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 18 },
  link: { color: colors.primary, fontWeight: '600', fontSize: 14 },
});
