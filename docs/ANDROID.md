# Android Studio, Expo et APK

## Livrables

L’application React Native/Expo est réelle et partage l’API et les autorisations du web. Le dossier apps/mobile/android est généré et s’ouvre dans Android Studio installé sous C:/Program Files/Android/Android Studio. Le package Android est bj.sosdocteurs.mobile.

Les écrans couvrent connexion et inscription, demandes client et bénéficiaires, missions et suivi professionnel, disponibilités, justificatifs, coordination, factures/paiements, support, notifications et guide informatif. La navigation dépend du rôle. Le jeton est stocké dans SecureStore ; les données de soins restent en mémoire. La position est facultative. Les fichiers temporaires des justificatifs sont supprimés après téléversement.

## Développement

Lancer la base et l’API avec les commandes du README, puis :

```powershell
npm.cmd run dev:mobile
```

L’émulateur Android utilise http://10.0.2.2:4000/api. Un téléphone utilise l’adresse IP LAN de l’ordinateur, sur le même réseau. Si le pare-feu bloque, autoriser le port 4000 uniquement sur ce réseau privé. Pour USB : adb reverse tcp:4000 tcp:4000 puis http://127.0.0.1:4000/api. En démo, l’écran de connexion permet de régler cette adresse ; changer de serveur efface la session. Une API de production doit être HTTPS.

Expo Go peut demander une version compatible. Pour un client natif : npm.cmd run android -w @sos/mobile ou compiler dans Android Studio. Le bundle Hermes exporté dans artifacts/mobile-bundle démontre que le code JavaScript se compile ; il ne permet pas d’installer l’application seul.

## Gradle local

```powershell
npm.cmd run android:prebuild
npm.cmd run android:apk
```

scripts/build-android.ps1 utilise le JDK 17 portable dans .cache/jdk17 s’il existe, sinon le JBR d’Android Studio. Le JBR installé est en version 25 et ne correspond pas au JDK 17 validé pour cette chaîne. Le téléchargement du JDK 17 par node scripts/download-jdk.mjs vérifie son SHA-256. Extraire ensuite .cache/jdk17.zip dans .cache/jdk17 avec Expand-Archive avant compilation. Les caches Gradle et Android sont rangés dans .cache du projet.

Installer dans SDK Manager les composants demandés par Gradle : plateforme Android 36, Build Tools 36, NDK et CMake des versions indiquées par le projet. Le poste disposait initialement de la plateforme 37, ce qui ne remplace pas la plateforme 36. Prévoir plusieurs Go libres pour SDK, dépendances et compilation C++. La machine possède environ 7 Go de RAM et très peu d’espace libre ; un échec natif par manque de mémoire a été confirmé dans un journal Java. Les propriétés Gradle ont été réduites à un worker et un tas de 1 Go.

Le script ne copie artifacts/SOS-DOCTEURS-demo.apk que si assembleRelease réussit et que le fichier existe. Vérifier le résultat dans VERIFICATION.md. Ne pas distribuer une version démo signée par la clé de développement. Une compilation -Production réussie sera copiée sous artifacts/SOS-DOCTEURS-production.apk.

## Production

Configurer EXPO_PUBLIC_API_URL=https://api.votre-domaine/api, EXPO_PUBLIC_DEMO_MODE=false et EXPO_PUBLIC_WEB_URL=https://votre-domaine dans apps/mobile/.env.local avant prebuild. Pour une signature locale, renseigner les variables SOS_KEYSTORE_FILE, SOS_KEYSTORE_PASSWORD, SOS_KEY_ALIAS et SOS_KEY_PASSWORD par un gestionnaire de secrets puis :

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/build-android.ps1 -Production
```

Consulter plugins/with-release-signing.cjs pour les noms exacts si vous adaptez le fournisseur de signature. Conserver le keystore et ses mots de passe hors dépôt et disposer d’une sauvegarde chiffrée. Pour un AAB, passer -Task bundleRelease ; le fichier reste sous apps/mobile/android/app/build/outputs/bundle/release.

EAS est également configuré dans apps/mobile/eas.json : profil development, preview APK, production AAB. Après connexion au compte Expo du propriétaire, rattacher son projet et lancer depuis apps/mobile : npx.cmd eas-cli build --platform android --profile preview. Les comptes Expo, signature de distribution, domaine et secrets de production n’ont pas été fournis ; aucune construction EAS distante n’a été lancée.

## Essais avant diffusion

Les contrôles de types, compatibilité Expo, prebuild et export Hermes sont réalisables localement. Les permissions sur appareil, TalkBack, clavier, liens de paiement, retour depuis le navigateur, liens profonds, réseau lent et cycle complet sur téléphone doivent encore être vérifiés. Une capture du web mobile ne constitue pas un test Android natif.
