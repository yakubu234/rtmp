import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: './',
  publicDir: './public',
  server: {
    port: 4000
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        producer: resolve(__dirname, 'producer.html'),
        consumer: resolve(__dirname, 'consumer.html'),
      }
    }
  }
});
