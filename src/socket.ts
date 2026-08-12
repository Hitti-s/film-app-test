import { io } from 'socket.io-client'

// На телефоне берём IP компьютера из адреса открытого сайта.
// Для опубликованной версии можно указать VITE_SERVER_URL в .env.
const serverUrl = import.meta.env.VITE_SERVER_URL
  || `${window.location.protocol}//${window.location.hostname}:3001`

export const socket = io(serverUrl, {
  // The server reconnects automatically after a brief Wi-Fi interruption.
  autoConnect: true,
})
