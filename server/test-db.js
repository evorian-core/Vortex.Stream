
import { pool, testDatabaseConnection } from './db.js';

async function main() {
  console.log('🔌 Testando conexão com a Neon...');

  try {
    const info = await testDatabaseConnection();

    console.log('\n✅ Conexão com a Neon estabelecida!');
    console.log('Banco:', info.database_name);
    console.log('Horário do servidor:', info.server_time);
    console.log('Versão:', info.postgres_version);
  } catch (error) {
    console.error('\n❌ Falha na conexão com a Neon.');
    console.error('Código:', error.code ?? 'não informado');
    console.error('Erro:', error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

main();
