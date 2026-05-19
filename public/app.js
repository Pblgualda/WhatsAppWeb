const socket = io();

const opcionesAvatares = [
  'avatars/avatar1.png',
  'avatars/avatar2.png',
  'avatars/avatar3.png',
  'avatars/avatar4.png'
];
const listaUsuariosEl = document.getElementById('userList');
const mensajesChatEl = document.getElementById('chatMessages');
const indicadorEscrituraEl = document.getElementById('typingIndicator');
const overlayLogin = document.getElementById('loginOverlay');
const entradaNombre = document.getElementById('nameInput');
const entradaEstado = document.getElementById('statusInput');
const opcionesAvataresEl = document.getElementById('avatarOptions');
const botonIniciar = document.getElementById('startButton');
const formularioMensaje = document.getElementById('messageForm');
const inputTexto = document.getElementById('inputTexto');

let usuarioActual = null;
let tiempoEscritura = null;
let usuarioEscribiendo = null;
let usuarioSeleccionado = null;
let chatsPrivados = {}; 

function renderizarAvatares() {
  opcionesAvataresEl.innerHTML = '';
  opcionesAvatares.forEach((avatar, index) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'avatar-option';
    button.innerHTML = `<img src="${avatar}" alt="Avatar ${index + 1}" />`;
    button.dataset.avatar = avatar;
    if (index === 0) button.classList.add('selected');
    button.addEventListener('click', () => {
      document.querySelectorAll('.avatar-option').forEach((item) => item.classList.remove('selected'));
      button.classList.add('selected');
    });
    opcionesAvataresEl.appendChild(button);
  });
}

function obtenerAvatarSeleccionado() {
  const selected = document.querySelector('.avatar-option.selected');
  return selected ? selected.dataset.avatar : opcionesAvatares[0];
}

function formatearHora(timestamp) {
  const date = new Date(timestamp);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function renderizarListaUsuarios(usuarios) {
  listaUsuariosEl.innerHTML = usuarios
    .map((user) => `
      <li class="user-item ${usuarioSeleccionado?.name === user.name && usuarioSeleccionado?.avatar === user.avatar ? 'selected' : ''}" data-user-name="${user.name}" data-user-avatar="${user.avatar}">
        <span class="user-avatar"><img src="${user.avatar}" alt="Avatar de ${user.name}" /></span>
        <span>
          <strong>${user.name}</strong>
          <span class="user-status">${user.status}</span>
        </span>
      </li>
    `)
    .join('');
  
  // Agregar event listeners a cada usuario
  document.querySelectorAll('.user-item').forEach((item) => {
    item.addEventListener('click', () => {
      const userName = item.dataset.userName;
      const userAvatar = item.dataset.userAvatar;
      const user = usuarios.find((u) => u.name === userName && u.avatar === userAvatar);
      if (user.name !== usuarioActual.name) {
        seleccionarUsuario(user);
      }
    });
  });
}

// Nota: sanitización removida por decisión del proyecto

function agregarMensajeChat(mensaje, opciones = {}) {
  const li = document.createElement('li');
  li.className = opciones.type || 'chat-message';
  if (opciones.system) {
    li.innerHTML = `<span class="system-text">${mensaje}</span>`;
  } else {
    li.innerHTML = `
      <div class="message-top">
        <span class="message-avatar"><img src="${mensaje.user.avatar}" alt="Avatar de ${mensaje.user.name}" /></span>
        <div class="message-bubble">
          <div class="message-author">${mensaje.user.name}</div>
          <div class="message-text">${mensaje.text}</div>
          <div class="message-time">${formatearHora(mensaje.time)}</div>
        </div>
      </div>
    `;
    if (mensaje.user.name === usuarioActual.name && mensaje.user.avatar === usuarioActual.avatar) {
      li.classList.add('mine');
    }
  }
  mensajesChatEl.appendChild(li);
  mensajesChatEl.scrollTop = mensajesChatEl.scrollHeight;
}


function seleccionarUsuario(user) {
  // Si el usuario ya está seleccionado, deseleccionar (volver a sala común)
  if (usuarioSeleccionado && usuarioSeleccionado.name === user.name && usuarioSeleccionado.avatar === user.avatar) {
    usuarioSeleccionado = null;
  } else {
    usuarioSeleccionado = user;
    
    // Inicializar chat privado si no existe
    const chatKey = `${user.name}-${user.avatar}`;
    if (!chatsPrivados[chatKey]) {
      chatsPrivados[chatKey] = [];
    }
  }
  
  // Actualizar UI
  renderizarListaUsuarios(usuarios);
  actualizarEncabezadoChat();
  if (usuarioSeleccionado) {
    const chatKey = `${usuarioSeleccionado.name}-${usuarioSeleccionado.avatar}`;
    renderizarChatPrivado(chatKey);
  } else {
    // Volver a mostrar sala común
    mensajesChatEl.innerHTML = '';
  }
}
 // Almacenar la lista de usuarios

let usuarios = [];

function actualizarEncabezadoChat() {
  const chatHeader = document.querySelector('.chat-header');
  const avatarEl = chatHeader.querySelector('.chat-avatar');
  const titleEl = chatHeader.querySelector('h1');
  const subtitleEl = document.getElementById('chatSubtitle');
  
  if (usuarioSeleccionado) {
    titleEl.textContent = usuarioSeleccionado.name;
    subtitleEl.textContent = usuarioSeleccionado.status || 'Sin estado';
    avatarEl.innerHTML = `<img src="${usuarioSeleccionado.avatar}" alt="Avatar de ${usuarioSeleccionado.name}" />`;
    avatarEl.classList.add('private');
  } else {
    titleEl.textContent = 'Sala común';
    subtitleEl.textContent = 'Todos los usuarios pueden chatear aquí.';
    avatarEl.textContent = '💬';
    avatarEl.classList.remove('private');
  }
}

function renderizarChatPrivado(chatKey) {
  mensajesChatEl.innerHTML = '';
  const messages = chatsPrivados[chatKey] || [];
  messages.forEach((message) => {
    agregarMensajeChat(message);
  });
}

function mostrarEscritura() {
  if (!usuarioEscribiendo || usuarioEscribiendo === usuarioActual?.name) {
    indicadorEscrituraEl.textContent = '';
    indicadorEscrituraEl.classList.remove('visible');
    return;
  }
  indicadorEscrituraEl.textContent = `${usuarioEscribiendo} está escribiendo...`;
  indicadorEscrituraEl.classList.add('visible');
}

function iniciarEscritura() {
  socket.emit('typing');
  clearTimeout(tiempoEscritura);
  tiempoEscritura = setTimeout(() => socket.emit('stopTyping'), 1000);
}

function detenerEscritura() {
  socket.emit('stopTyping');
}

botonIniciar.addEventListener('click', () => {
  const name = entradaNombre.value.trim();
  const status = entradaEstado.value.trim() || 'Disponible';
  const avatar = obtenerAvatarSeleccionado();
  usuarioActual = { name, status, avatar };
  overlayLogin.classList.add('hidden');
  renderizarListaUsuarios([usuarioActual]);
  socket.emit('login', usuarioActual);
  agregarMensajeChat(`Bienvenido al chat, ${name}!`, { system: true, type: 'system-message' });
});

formularioMensaje.addEventListener('submit', (event) => {
  event.preventDefault();
  const text = inputTexto.value.trim();
  if (!text) return;
  
  if (usuarioSeleccionado) {
    // Enviar mensaje privado
    socket.emit('mensajeTexto', {
      text,
      destinatario: usuarioSeleccionado.name,
      destinatarioAvatar: usuarioSeleccionado.avatar
    });
  } else {
    // Enviar mensaje público
    socket.emit('mensajeTexto', { text });
  }
  
  inputTexto.value = '';
  detenerEscritura();
});

inputTexto.addEventListener('input', () => {
  if (inputTexto.value.trim().length > 0) {
    iniciarEscritura();
  } else {
    detenerEscritura();
  }
});

socket.on('userList', (userList) => {
  usuarios = userList;
  renderizarListaUsuarios(userList);
});
socket.on('mensaje', (message) => {
  // Mensaje público
  if (!usuarioSeleccionado) {
    agregarMensajeChat(message);
  }
});

socket.on('mensajePrivado', (message) => {
  const chatKey = `${message.destinatario}-${message.user.avatar}`;
  const otherKey = `${message.user.name}-${message.user.avatar}`;
  let targetKey;
  if (message.user.name === usuarioActual.name) {
    targetKey = chatKey;
  } else {
    targetKey = otherKey;
  }
  if (!chatsPrivados[targetKey]) {
    chatsPrivados[targetKey] = [];
  }
  chatsPrivados[targetKey].push(message);
  if (usuarioSeleccionado && 
      ((message.user.name === usuarioSeleccionado.name && message.user.avatar === usuarioSeleccionado.avatar) ||
       (message.destinatario === usuarioSeleccionado.name && message.user.name === usuarioActual.name))) {
    agregarMensajeChat(message);
  }
});
socket.on('userJoined', (user) => {
  agregarMensajeChat(`${user.name} se ha unido al chat.`, { system: true, type: 'system-message' });
});
socket.on('userLeft', (user) => {
  agregarMensajeChat(`${user.name} ha abandonado el chat.`, { system: true, type: 'system-message' });
});
socket.on('typing', (user) => {
  usuarioEscribiendo = user.name;
  mostrarEscritura();
});
socket.on('stopTyping', (user) => {
  if (usuarioEscribiendo === user.name) {
    usuarioEscribiendo = null;
  }
  mostrarEscritura();
});

renderizarAvatares();

window.addEventListener('beforeunload', () => {
  detenerEscritura();
});
