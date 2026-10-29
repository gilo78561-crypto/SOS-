const { withAppBuildGradle, withGradleProperties } = require('expo/config-plugins');
module.exports = function withReleaseSigning(config) {
  config = withGradleProperties(config, (mod) => {
    for (const [key, value] of Object.entries({
      'org.gradle.jvmargs': '-Xmx1024m -XX:MaxMetaspaceSize=384m',
      'kotlin.compiler.execution.strategy': 'in-process',
    })) {
      const prop = mod.modResults.find((p) => p.type === 'property' && p.key === key);
      if (prop) prop.value = value;
      else mod.modResults.push({ type: 'property', key, value });
    }
    return mod;
  });
  return withAppBuildGradle(config, (mod) => {
    let text = mod.modResults.contents;
    if (text.includes('def sosProduction')) return mod;
    text = text.replace(
      'android {',
      "def sosProduction = System.getenv('SOS_PRODUCTION_BUILD') == 'true'\nif (sosProduction && System.getenv('EAS_BUILD') != 'true' && !System.getenv('SOS_KEYSTORE_FILE')) { throw new GradleException('Production keystore required. Configure SOS_KEYSTORE_FILE, SOS_KEYSTORE_PASSWORD, SOS_KEY_ALIAS, SOS_KEY_PASSWORD.') }\nandroid {",
    );
    text = text.replace(
      'signingConfigs {',
      "signingConfigs {\n        release {\n            if (System.getenv('SOS_KEYSTORE_FILE')) {\n                storeFile file(System.getenv('SOS_KEYSTORE_FILE'))\n                storePassword System.getenv('SOS_KEYSTORE_PASSWORD')\n                keyAlias System.getenv('SOS_KEY_ALIAS')\n                keyPassword System.getenv('SOS_KEY_PASSWORD')\n            }\n        }",
    );
    text = text.replace(
      'signingConfig signingConfigs.debug\n            def enableShrinkResources',
      'signingConfig sosProduction ? signingConfigs.release : signingConfigs.debug\n            def enableShrinkResources',
    );
    mod.modResults.contents = text;
    return mod;
  });
};
