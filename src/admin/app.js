import LogButton from "./extensions/components/LogButton/index.js";
import SyncAllButton from "./extensions/components/SyncAllButton/index.js";

const config = {
  locales: [
    // 'ar',
    // 'fr',
    // 'cs',
    // 'de',
    // 'dk',
    // 'es',
    // 'he',
    // 'id',
    // 'it',
    // 'ja',
    // 'ko',
    // 'ms',
    // 'nl',
    // 'no',
    // 'pl',
    // 'pt-BR',
    // 'pt',
    // 'ru',
    // 'sk',
    // 'sv',
    // 'th',
    // 'tr',
    // 'uk',
    // 'vi',
    // 'zh-Hans',
    // 'zh',
  ],
};

const bootstrap = (app) => {
  console.log("Custom button extension loaded");
  app.injectContentManagerComponent("editView", "right-links", {
    name: "log-button",
    Component: LogButton,
  });
  app.injectContentManagerComponent("editView", "right-links", {
    name: "sync-all-button",
    Component: SyncAllButton,
  });
};

export default {
  config,
  bootstrap,
};
