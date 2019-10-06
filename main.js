const { menubar } = require('menubar');
const fetch = require('electron-fetch');
const electron = require('electron');
const moment = require('moment');
const Store = require('electron-store');
const isDev = require('electron-is-dev');
const queryString = require('query-string');
const { autoUpdater } = require("electron-updater");
const { OAuth2Provider } = require('electron-oauth-helper');

require('electron-context-menu')();

const ipc = electron.ipcMain;
const BrowserWindow = electron.BrowserWindow;
const Menu = electron.Menu;
const MenuItem = electron.MenuItem
const Notification = electron.Notification;
const app = electron.app;

const store = new Store();
const settingMenu = new Menu();
const prefix_url = 'https://api.github.com/user';

const retrieve = (url, token) => {
  return fetch.default(url, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3.raw'
    }
  }).then((res) => {
    if (res.status > 201) {
      return res;
    }
    return res.json();
  })
};

const mb = menubar({
  browserWindow: {
    width: 300,
    y: 30,
    height: 400,
    webPreferences: {
      nodeIntegration: true
    }
  },
  resizable: isDev || false,
  icon: __dirname + '/IconTemplate.png',
  tooltip: 'Assigned - See what issues await you'
});

const startUp = () => {
  if (typeof store.get('open') === 'undefined') {
    store.set('open', true);
  }

  mb.app.setLoginItemSettings({openAtLogin: store.get('open')});

  store.set('time', moment().utc());

  mb.showWindow();
  mb.hideWindow();
};

const changeOpenLogin = () => {
  const isOpen = store.get('open');
  store.set('open', !isOpen);

  mb.app.setLoginItemSettings({openAtLogin: store.get('open')});
};

const setMenu = () => {
  if (isDev) {
    settingMenu.append(new MenuItem({ label: 'Inspect Element', click: () => { mb.window.openDevTools() }}));
  }
  if (store.get('token')) {
    settingMenu.append(new MenuItem({ label: 'Log out', click: () => { store.set('token', null); mb.window.reload();} }));
  }
  settingMenu.append(new MenuItem({ label: 'Open on startup', type: 'checkbox', checked: store.get('open'), click: () => {changeOpenLogin();}}));
  settingMenu.append(new MenuItem({ type: 'separator' }))
  settingMenu.append(new MenuItem({ label: 'About', selector: 'orderFrontStandardAboutPanel:' }));
  settingMenu.append(new MenuItem({ label: 'Quit', click: () => { mb.app.quit() }}));
};

mb.on('ready', () => {
  startUp();
  setMenu();
});

ipc.on('loaded', (event, arg) => {
  const token = store.get('token');
  const url = `${prefix_url}/issues?_=${moment().unix()}`;

  if (!store.get('token')) {
    event.sender.send('get-token');
    return false;
  }

  retrieve(url, token).then((json) => {
    if (json.status > 201) {
      arg = 'error';
    }

    const issues = json.map(issue => issue.id);
    store.set('issues', issues);

    event.sender.send(arg, json);
  }).catch((err) => {
    console.log(err);
    event.sender.send('error', err);
  });
});

ipc.on('update', (event, arg) => {
  autoUpdater.checkForUpdatesAndNotify();
  const token = store.get('token');
  const time = store.get('time');
  const since = `${moment(time).utc().format('YYYY-MM-DDTHH:mm')}Z`;
  const url = `${prefix_url}/issues?filter=assigned&since=${since}`;

  if (token) {
    retrieve(url, token).then((json) => {
      store.set('time', moment().utc());
      return json;
    })
    .then((json) => {
      if (json.length > 0) {
        const issues = store.get('issues');

        const data = json.map((issue) => {
          if (issues.indexOf(issue.id) === -1) {
            return issue;
          }
        }).filter(issue => issue);

        if (data.length > 0) {
          const dataId = data.map(issue => data.id);
          const allIssues = issues.concat([], dataId);

          store.set('issues', allIssues);
          event.sender.send(arg, data);
        }
      }
    })
    .catch((err) => {
      console.log(err);
    });
  }
});

ipc.on('show-context-menu', (event) => {
  settingMenu.popup(mb);
});

ipc.on('login', (event) => {
  const config = {
    client_id: 'a26ab83005e588b2866c',
    client_secret: '355ecb4a6d17358f1469c68444a853d29b350b79',
    scope: 'user, repo',
    redirect_uri: 'http://assigned',
    authorize_url: 'https://github.com/login/oauth/authorize',
    access_token_url: 'https://github.com/login/oauth/access_token',
  };

  const window = new BrowserWindow({
    show: false,
    width: 600,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  window.once('ready-to-show', () => {
    window.show();
  });

  const provider = new OAuth2Provider(config);

  provider.perform(window)
    .then((resp) => {
      const query = queryString.parse(resp);

      store.set('token', query.access_token);
      event.sender.send('load');

      window.close();
      mb.showWindow();
    }).catch(error => console.error(error));
});

app.on('ready', () => {
  const template = [{
    label: 'Edit',
    submenu: [
      { label: 'Undo', accelerator: 'CmdOrCtrl+Z', selector: 'undo:' },
      { label: 'Redo', accelerator: 'Shift+CmdOrCtrl+Z', selector: 'redo:' },
      { type: 'separator' },
      { label: 'Cut', accelerator: 'CmdOrCtrl+X', selector: 'cut:' },
      { label: 'Copy', accelerator: 'CmdOrCtrl+C', selector: 'copy:' },
      { label: 'Paste', accelerator: 'CmdOrCtrl+V', selector: 'paste:' },
      { label: 'Select All', accelerator: 'CmdOrCtrl+A', selector: 'selectAll:' }
    ]}
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
});
