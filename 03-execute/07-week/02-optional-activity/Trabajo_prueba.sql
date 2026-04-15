CREATE DATABASE sistema;
USE sistema;

-- =========================
-- DOMINIO UBICACION
-- =========================

CREATE TABLE continente (
  id_continente INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL
);

CREATE TABLE pais (
  id_pais INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  id_continente INT NOT NULL,
  FOREIGN KEY (id_continente) REFERENCES continente(id_continente)
);

CREATE TABLE departamento (
  id_departamento INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  id_pais INT NOT NULL,
  FOREIGN KEY (id_pais) REFERENCES pais(id_pais)
);

CREATE TABLE ciudad (
  id_ciudad INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  id_departamento INT NOT NULL,
  FOREIGN KEY (id_departamento) REFERENCES departamento(id_departamento)
);

CREATE TABLE barrio (
  id_barrio INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  id_ciudad INT NOT NULL,
  FOREIGN KEY (id_ciudad) REFERENCES ciudad(id_ciudad)
);

-- =========================
-- DOMINIO SEGURIDAD
-- =========================

CREATE TABLE rol (
  id_rol INT AUTO_INCREMENT PRIMARY KEY,
  nombre_rol VARCHAR(50) NOT NULL
);

CREATE TABLE persona (
  id_persona INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  apellido VARCHAR(100) NOT NULL,
  documento VARCHAR(50) NOT NULL,
  id_barrio INT NOT NULL,
  id_rol INT NOT NULL,
  FOREIGN KEY (id_barrio) REFERENCES barrio(id_barrio),
  FOREIGN KEY (id_rol) REFERENCES rol(id_rol)
);

CREATE TABLE usuario (
  id_usuario INT AUTO_INCREMENT PRIMARY KEY,
  nombre_usuario VARCHAR(100) NOT NULL,
  contrasena VARCHAR(100) NOT NULL,
  id_persona INT NOT NULL,
  FOREIGN KEY (id_persona) REFERENCES persona(id_persona)
);

-- =========================
-- DOMINIO COMERCIAL
-- =========================

CREATE TABLE categoria (
  id_categoria INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL
);

CREATE TABLE producto (
  id_producto INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  precio DECIMAL(10,2) NOT NULL,
  id_categoria INT NOT NULL,
  FOREIGN KEY (id_categoria) REFERENCES categoria(id_categoria)
);

CREATE TABLE factura (
  id_factura INT AUTO_INCREMENT PRIMARY KEY,
  fecha DATE NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  id_usuario INT NOT NULL,
  FOREIGN KEY (id_usuario) REFERENCES usuario(id_usuario)
);

CREATE TABLE detalle_factura (
  id_detalle INT AUTO_INCREMENT PRIMARY KEY,
  id_factura INT NOT NULL,
  id_producto INT NOT NULL,
  cantidad INT NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  FOREIGN KEY (id_factura) REFERENCES factura(id_factura),
  FOREIGN KEY (id_producto) REFERENCES producto(id_producto)
);