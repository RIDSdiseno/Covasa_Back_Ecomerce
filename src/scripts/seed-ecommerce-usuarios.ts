import "../lib/env";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma";

type SeedUsuario = {
  nombre: string;
  email: string;
  password: string;
  telefono?: string;
};

const usuarios: SeedUsuario[] = [
  { nombre: "Demo 1", email: "demo1@covasa.cl", password: "Demo1234!" },
  { nombre: "Demo 2", email: "demo2@covasa.cl", password: "Demo1234!" },
];

const normalizarTexto = (valor?: string) => (valor ?? "").trim();
const normalizarEmail = (email: string) => normalizarTexto(email).toLowerCase();

const resolverSaltRounds = () => {
  const valor = Number(process.env.ECOMMERCE_SALT_ROUNDS ?? 10);
  if (!Number.isFinite(valor) || valor < 6 || valor > 15) {
    return 10;
  }
  return Math.floor(valor);
};

const upsertUsuario = async (payload: SeedUsuario) => {
  const email = normalizarEmail(payload.email);
  const nombre = normalizarTexto(payload.nombre) || email;
  const telefono = normalizarTexto(payload.telefono) || undefined;
  const passwordHash = await bcrypt.hash(payload.password, resolverSaltRounds());

  return prisma.$transaction(async (tx) => {
    const existente = await tx.ecommerceUsuario.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existente) {
      await tx.ecommerceUsuario.update({
        where: { id: existente.id },
        data: {
          nombre,
          telefono,
          passwordHash,
        },
      });

      const clienteExistente = await tx.ecommerceCliente.findFirst({
        where: {
          OR: [
            { usuarioId: existente.id },
            { emailContacto: { equals: email, mode: "insensitive" } },
          ],
        },
        select: { id: true, usuarioId: true },
      });

      if (clienteExistente?.usuarioId && clienteExistente.usuarioId !== existente.id) {
        return {
          status: "skipped",
          email,
          usuarioId: existente.id,
          reason: "Email ya asociado a otro cliente ecommerce.",
        };
      }

      if (clienteExistente) {
        await tx.ecommerceCliente.update({
          where: { id: clienteExistente.id },
          data: {
            nombres: nombre,
            emailContacto: email,
            telefono,
            usuario: { connect: { id: existente.id } },
          },
        });
        return {
          status: "updated",
          email,
          usuarioId: existente.id,
          clienteId: clienteExistente.id,
        };
      }

      const cliente = await tx.ecommerceCliente.create({
        data: {
          nombres: nombre,
          emailContacto: email,
          telefono,
          usuario: { connect: { id: existente.id } },
        },
        select: { id: true },
      });

      return {
        status: "updated",
        email,
        usuarioId: existente.id,
        clienteId: cliente.id,
      };
    }

    const creado = await tx.ecommerceUsuario.create({
      data: {
        nombre,
        email,
        telefono,
        passwordHash,
      },
      select: { id: true },
    });

    const cliente = await tx.ecommerceCliente.create({
      data: {
        nombres: nombre,
        emailContacto: email,
        telefono,
        usuario: { connect: { id: creado.id } },
      },
      select: { id: true },
    });

    return {
      status: "created",
      email,
      usuarioId: creado.id,
      clienteId: cliente.id,
    };
  });
};

const main = async () => {
  for (const usuario of usuarios) {
    const resultado = await upsertUsuario(usuario);
    if (resultado.status === "skipped") {
      console.log(`[SKIP] ${resultado.email}: ${resultado.reason}`);
    } else {
      console.log(`[${resultado.status.toUpperCase()}] ${resultado.email} -> usuario ${resultado.usuarioId}`);
    }
  }
};

main()
  .catch((error) => {
    const mensaje = error instanceof Error ? error.message : String(error);
    console.error("Seed ecommerce usuarios fallo:", mensaje);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
