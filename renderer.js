const inputMenu = require('electron-input-menu');
const context = require('electron-contextmenu-middleware');
const ipc = require('electron').ipcRenderer;
const shell = require('electron').shell;

inputMenu.registerShortcuts();
context.use(inputMenu);
context.activate();

const {tokenHtml, createView, errorMessage} = require('./render_html');

const contextMenuBtn = document.getElementById('context-menu');
const refreshMenuBtn = document.getElementById('refresh-menu');
const refreshIcon = document.getElementById('refresh-icon');

ipc.send('loaded', 'ready');

setInterval(() => { ipc.send('update', 'update'); }, 30000);

const links = () => {
  const links = document.querySelectorAll('a[href]')

  Array.prototype.forEach.call(links, (link) => {
    const url = link.getAttribute('href');

    if (url.indexOf('http') === 0) {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        shell.openExternal(url);
      })
    }
  });
};

ipc.on('load', (event, arg) => {
  ipc.send('loaded', 'ready');
});

ipc.on('ready', (event, arg) => {
  refreshIcon.classList.remove('spin');
  document.getElementById('details').innerHTML = createView(arg);
  links();
});

ipc.on('update', (event, arg) => {
  if (arg.length > 0) {
    arg.forEach((n) => {
      const notification = new Notification(n.title, {
        body: n.repository.name,
        silent: true
      });

      notification.onclick = () => {
        shell.openExternal(n.html_url);
      };
    });

    ipc.send('loaded', 'ready');
  }
});

ipc.on('get-token', (event, arg) => {
  document.getElementById('details').innerHTML = tokenHtml();

  const tokenBtn = document.getElementById('token-btn');
  tokenBtn.addEventListener('click', () => {
    ipc.send('login');
  });
})

ipc.on('error', (event, arg) => {
  document.getElementById('details').innerHTML = errorMessage();
});

contextMenuBtn.addEventListener('click', () => {
  ipc.send('show-context-menu');
});

refreshMenuBtn.addEventListener('click', () => {
  refreshIcon.classList.add('spin');
  ipc.send('loaded', 'ready');
});
