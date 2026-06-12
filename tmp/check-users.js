const { Client } = require('pg');

const client = new Client({
  connectionString: 'postgresql://neondb_owner:npg_dDzq0Gt7QsYM@ep-holy-snow-anknrwin-pooler.c-6.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
});

client.connect()
  .then(() => client.query('SELECT id, name, email, "createdAt" FROM "User" LIMIT 20'))
  .then(res => {
    console.log('Usuarios encontrados no Neon:', res.rows.length);
    res.rows.forEach(u => console.log(' -', u.email, '| nome:', u.name));
    return client.end();
  })
  .catch(e => {
    console.error('Erro ao conectar/consultar:', e.message);
    client.end();
  });
