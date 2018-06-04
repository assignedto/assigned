require('dotenv').config();

const menubar = require('menubar');
const fetch = require('electron-fetch');
const electron = require('electron');
const moment = require('moment');
const Store = require('electron-store');
const isDev = require('electron-is-dev');
const queryString = require('query-string');
const { autoUpdater } = require("electron-updater");
const { OAuth2Provider } = require('electron-oauth-helper');

const ipc = electron.ipcMain;
const BrowserWindow = electron.BrowserWindow;
const Menu = electron.Menu;
const MenuItem = electron.MenuItem
const Notification = electron.Notification;

const store = new Store();
const settingMenu = new Menu();
const prefix_url = 'https://api.github.com/user';

const retrieve = (url, token) => {
  return fetch(url, {
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
  width: 300,
  height: 400,
  resizable: isDev || false,
  icon: __dirname + '/IconTemplate.png',
  y: 30,
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

  retrieve(url, token).then((json) => {
    store.set('time', moment().utc());
    return json;
  })
  .then((json) => {
    if (json.length > 0) {
      event.sender.send(arg, json);
    }
  })
  .catch((err) => {
    console.log(err);
  });
});

ipc.on('show-context-menu', (event) => {
  settingMenu.popup(mb);
});

ipc.on('login', (event) => {
  const config = {
    client_id: process.env.CLIENT_ID,
    client_secret: process.env.CLIENT_SECRET,
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
