import {fileURLToPath} from 'node:url';
const api=(process.env.API_INTERNAL_URL||'http://127.0.0.1:3002').replace(/\/$/,'');
const auth=(process.env.AUTH_INTERNAL_URL||'http://127.0.0.1:3001').replace(/\/$/,'');
export default {output:'standalone',outputFileTracingRoot:fileURLToPath(new URL('../..',import.meta.url)),async rewrites(){return [{source:'/api/v1/:path*',destination:api+'/api/v1/:path*'},{source:'/api/auth/:path*',destination:auth+'/api/auth/:path*'}]}};
