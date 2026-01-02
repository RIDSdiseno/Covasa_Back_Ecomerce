import "../lib/env";
import { Client } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL no esta configurado.");
}

const tablasEcommerce = [
  "ecommerce_usuario",
  "ecommerce_cliente",
  "ecommerce_direccion",
  "ecommerce_carrito",
  "ecommerce_carrito_item",
  "ecommerce_cotizacion",
  "ecommerce_cotizacion_item",
  "ecommerce_pedido",
  "ecommerce_pedido_item",
  "ecommerce_pago",
  "ecommerce_notificacion",
];

const imprimirFila = (label: string, valor: unknown) => {
  console.log(`${label}:`, valor);
};

const main = async () => {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    const info = await client.query(
      "SELECT current_database() AS database, current_schema() AS schema, version()"
    );
    imprimirFila("Conexion", info.rows[0]);

    const tablasRes = await client.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = current_schema()
         AND table_type = 'BASE TABLE'
         AND table_name LIKE 'ecommerce_%'
       ORDER BY table_name`
    );

    const tablas = tablasRes.rows.map((row) => row.table_name);
    imprimirFila("Tablas ecommerce", tablas);

    console.log("Conteos:");
    for (const tabla of tablasEcommerce) {
      if (!tablas.includes(tabla)) {
        console.log(`- ${tabla}: MISSING`);
        continue;
      }
      const countRes = await client.query(`SELECT COUNT(*)::int AS count FROM "${tabla}"`);
      console.log(`- ${tabla}: ${countRes.rows[0].count}`);
    }
  } finally {
    await client.end();
  }
};

main().catch((error) => {
  const mensaje = error instanceof Error ? error.message : String(error);
  console.error("Diagnostico DB fallo:", mensaje);
  process.exitCode = 1;
});
