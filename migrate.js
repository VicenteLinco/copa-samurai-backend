const mongoose = require('mongoose');
require('dotenv').config();

// Conectar a MongoDB
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/copa-samurai')
  .then(async () => {
    console.log('✅ MongoDB conectado');
    await migrate();
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Error MongoDB:', err);
    process.exit(1);
  });

async function migrate() {
  try {
    console.log('\n🔄 INICIANDO MIGRACIÓN...\n');

    // 1. Guardar dojos y senseis
    console.log('📦 Guardando dojos y senseis...');
    const dojos = await mongoose.connection.db.collection('dojos').find().toArray();
    const senseis = await mongoose.connection.db.collection('senseis').find().toArray();
    console.log(`   - ${dojos.length} dojos guardados`);
    console.log(`   - ${senseis.length} senseis guardados`);

    // 2. Eliminar todas las colecciones excepto dojos y senseis
    console.log('\n🗑️  Eliminando colecciones antiguas...');

    const collections = ['participantes', 'equipos', 'categorias', 'disciplinas', 'rangoedades', 'configuracions', 'brackets'];

    for (const collectionName of collections) {
      try {
        await mongoose.connection.db.collection(collectionName).drop();
        console.log(`   - ✅ Eliminada: ${collectionName}`);
      } catch (error) {
        if (error.message.includes('ns not found')) {
          console.log(`   - ⚠️  No existe: ${collectionName}`);
        } else {
          throw error;
        }
      }
    }

    // 3. Eliminar índices antiguos de categorías si existe la colección
    console.log('\n🔧 Recreando colección de categorías con nuevos índices...');
    try {
      await mongoose.connection.db.createCollection('categorias');
      console.log('   - ✅ Colección categorias creada');
    } catch (error) {
      console.log('   - ⚠️  Colección categorias ya existe');
    }

    console.log('\n✅ MIGRACIÓN COMPLETADA!');
    console.log('\n📊 Resumen:');
    console.log(`   - Dojos conservados: ${dojos.length}`);
    console.log(`   - Senseis conservados: ${senseis.length}`);
    console.log('   - Otras colecciones reseteadas');
    console.log('\n🚀 Ahora puedes iniciar el servidor con: node server.js');
    console.log('   El sistema creará automáticamente todas las categorías nuevas.');

  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    throw error;
  }
}
