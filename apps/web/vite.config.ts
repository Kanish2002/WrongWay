import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
  plugins:[react(),VitePWA({registerType:'autoUpdate',includeAssets:['icon.svg'],manifest:{name:'Wrong Way — Strategy Board Game',short_name:'Wrong Way',description:'A beautiful two-player wall-and-path strategy game.',theme_color:'#0b101a',background_color:'#0b101a',display:'standalone',orientation:'any',start_url:'/',icons:[{src:'/icon.svg',sizes:'any',type:'image/svg+xml',purpose:'any maskable'}]},workbox:{globPatterns:['**/*.{js,css,html,svg,png,woff2}'],navigateFallback:'/index.html'}})],
  server:{port:5173,proxy:{'/socket.io':{target:'http://localhost:3001',ws:true}}}
});
