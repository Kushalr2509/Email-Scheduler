const axios = require('axios');
const instance = axios.create({ baseURL: '/admin/queues/api' });
console.log(instance.getUri({ url: '/queues' }));
