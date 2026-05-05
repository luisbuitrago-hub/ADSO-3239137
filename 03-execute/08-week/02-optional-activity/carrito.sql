-- MySQL dump 10.13  Distrib 8.0.45, for Win64 (x86_64)
--
-- Host: 127.0.0.1    Database: carrito
-- ------------------------------------------------------
-- Server version	8.0.45

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `carrito`
--

DROP TABLE IF EXISTS `carrito`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `carrito` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `cliente_id` bigint unsigned DEFAULT NULL,
  `fecha_creacion` datetime DEFAULT CURRENT_TIMESTAMP,
  `total` decimal(12,2) DEFAULT '0.00',
  `estado_id` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `cliente_id` (`cliente_id`),
  KEY `estado_id` (`estado_id`),
  CONSTRAINT `carrito_ibfk_1` FOREIGN KEY (`cliente_id`) REFERENCES `cliente` (`id`),
  CONSTRAINT `carrito_ibfk_2` FOREIGN KEY (`estado_id`) REFERENCES `estado` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `carrito`
--

LOCK TABLES `carrito` WRITE;
/*!40000 ALTER TABLE `carrito` DISABLE KEYS */;
INSERT INTO `carrito` VALUES (1,1,'2026-05-05 02:12:41',10000.00,1),(2,2,'2026-05-05 02:27:41',20000.00,1),(3,3,'2026-05-05 02:27:41',30000.00,1),(4,4,'2026-05-05 02:27:41',40000.00,1);
/*!40000 ALTER TABLE `carrito` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `carrito_item`
--

DROP TABLE IF EXISTS `carrito_item`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `carrito_item` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `carrito_id` bigint unsigned DEFAULT NULL,
  `producto_id` bigint unsigned DEFAULT NULL,
  `cantidad` int DEFAULT NULL,
  `precio_unitario` decimal(12,2) DEFAULT NULL,
  `subtotal` decimal(12,2) DEFAULT NULL,
  `estado_id` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `carrito_id` (`carrito_id`),
  KEY `producto_id` (`producto_id`),
  KEY `estado_id` (`estado_id`),
  CONSTRAINT `carrito_item_ibfk_1` FOREIGN KEY (`carrito_id`) REFERENCES `carrito` (`id`),
  CONSTRAINT `carrito_item_ibfk_2` FOREIGN KEY (`producto_id`) REFERENCES `producto` (`id`),
  CONSTRAINT `carrito_item_ibfk_3` FOREIGN KEY (`estado_id`) REFERENCES `estado` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `carrito_item`
--

LOCK TABLES `carrito_item` WRITE;
/*!40000 ALTER TABLE `carrito_item` DISABLE KEYS */;
INSERT INTO `carrito_item` VALUES (1,1,1,1,10000.00,10000.00,1),(2,2,2,1,20000.00,20000.00,1),(3,3,3,1,30000.00,30000.00,1),(4,4,4,1,40000.00,40000.00,1);
/*!40000 ALTER TABLE `carrito_item` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `cliente`
--

DROP TABLE IF EXISTS `cliente`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `cliente` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `persona_id` bigint unsigned DEFAULT NULL,
  `codigo_cliente` varchar(50) DEFAULT NULL,
  `puntos` int DEFAULT '0',
  `estado_id` bigint unsigned DEFAULT NULL,
  `creado_por` bigint unsigned DEFAULT NULL,
  `creado_en` datetime DEFAULT CURRENT_TIMESTAMP,
  `actualizado_por` bigint unsigned DEFAULT NULL,
  `actualizado_en` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `eliminado_por` bigint unsigned DEFAULT NULL,
  `eliminado_en` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `persona_id` (`persona_id`),
  UNIQUE KEY `codigo_cliente` (`codigo_cliente`),
  KEY `estado_id` (`estado_id`),
  CONSTRAINT `cliente_ibfk_1` FOREIGN KEY (`persona_id`) REFERENCES `persona` (`id`),
  CONSTRAINT `cliente_ibfk_2` FOREIGN KEY (`estado_id`) REFERENCES `estado` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `cliente`
--

LOCK TABLES `cliente` WRITE;
/*!40000 ALTER TABLE `cliente` DISABLE KEYS */;
INSERT INTO `cliente` VALUES (1,1,'CLI-001',0,1,NULL,'2026-05-05 02:12:41',NULL,'2026-05-05 02:12:41',NULL,NULL),(2,2,'CLI-002',0,1,NULL,'2026-05-05 02:27:41',NULL,'2026-05-05 02:27:41',NULL,NULL),(3,3,'CLI-003',0,1,NULL,'2026-05-05 02:27:41',NULL,'2026-05-05 02:27:41',NULL,NULL),(4,4,'CLI-004',0,1,NULL,'2026-05-05 02:27:41',NULL,'2026-05-05 02:27:41',NULL,NULL);
/*!40000 ALTER TABLE `cliente` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `estado`
--

DROP TABLE IF EXISTS `estado`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `estado` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `codigo` varchar(20) NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `descripcion` text,
  `nombre_dominio` varchar(100) DEFAULT NULL,
  `estado_id` bigint unsigned DEFAULT NULL,
  `creado_por` bigint unsigned DEFAULT NULL,
  `creado_en` datetime DEFAULT CURRENT_TIMESTAMP,
  `actualizado_por` bigint unsigned DEFAULT NULL,
  `actualizado_en` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `eliminado_por` bigint unsigned DEFAULT NULL,
  `eliminado_en` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `codigo` (`codigo`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `estado`
--

LOCK TABLES `estado` WRITE;
/*!40000 ALTER TABLE `estado` DISABLE KEYS */;
INSERT INTO `estado` VALUES (1,'ACTIVO','Activo',NULL,NULL,NULL,NULL,'2026-05-05 02:12:41',NULL,'2026-05-05 02:12:41',NULL,NULL),(2,'INACTIVO','Inactivo',NULL,NULL,NULL,NULL,'2026-05-05 02:12:41',NULL,'2026-05-05 02:12:41',NULL,NULL),(3,'PENDIENTE','Pendiente',NULL,NULL,NULL,NULL,'2026-05-05 02:27:41',NULL,'2026-05-05 02:27:41',NULL,NULL),(4,'ELIMINADO','Eliminado',NULL,NULL,NULL,NULL,'2026-05-05 02:27:41',NULL,'2026-05-05 02:27:41',NULL,NULL);
/*!40000 ALTER TABLE `estado` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `factura`
--

DROP TABLE IF EXISTS `factura`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `factura` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `orden_id` bigint unsigned DEFAULT NULL,
  `numero_factura` varchar(50) DEFAULT NULL,
  `total` decimal(12,2) DEFAULT NULL,
  `estado_id` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `orden_id` (`orden_id`),
  UNIQUE KEY `numero_factura` (`numero_factura`),
  KEY `estado_id` (`estado_id`),
  CONSTRAINT `factura_ibfk_1` FOREIGN KEY (`orden_id`) REFERENCES `orden` (`id`),
  CONSTRAINT `factura_ibfk_2` FOREIGN KEY (`estado_id`) REFERENCES `estado` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `factura`
--

LOCK TABLES `factura` WRITE;
/*!40000 ALTER TABLE `factura` DISABLE KEYS */;
/*!40000 ALTER TABLE `factura` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `metodo_pago`
--

DROP TABLE IF EXISTS `metodo_pago`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `metodo_pago` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `codigo` varchar(20) NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `descripcion` text,
  `estado_id` bigint unsigned DEFAULT NULL,
  `creado_por` bigint unsigned DEFAULT NULL,
  `creado_en` datetime DEFAULT CURRENT_TIMESTAMP,
  `actualizado_por` bigint unsigned DEFAULT NULL,
  `actualizado_en` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `eliminado_por` bigint unsigned DEFAULT NULL,
  `eliminado_en` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `codigo` (`codigo`),
  KEY `estado_id` (`estado_id`),
  CONSTRAINT `metodo_pago_ibfk_1` FOREIGN KEY (`estado_id`) REFERENCES `estado` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `metodo_pago`
--

LOCK TABLES `metodo_pago` WRITE;
/*!40000 ALTER TABLE `metodo_pago` DISABLE KEYS */;
INSERT INTO `metodo_pago` VALUES (1,'EFECTIVO','Efectivo',NULL,1,NULL,'2026-05-05 02:12:41',NULL,'2026-05-05 02:12:41',NULL,NULL),(2,'TARJETA','Tarjeta',NULL,1,NULL,'2026-05-05 02:27:41',NULL,'2026-05-05 02:27:41',NULL,NULL),(3,'TRANSFERENCIA','Transferencia',NULL,1,NULL,'2026-05-05 02:27:41',NULL,'2026-05-05 02:27:41',NULL,NULL);
/*!40000 ALTER TABLE `metodo_pago` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `orden`
--

DROP TABLE IF EXISTS `orden`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `orden` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `cliente_id` bigint unsigned DEFAULT NULL,
  `numero_orden` varchar(50) DEFAULT NULL,
  `fecha` datetime DEFAULT CURRENT_TIMESTAMP,
  `total` decimal(12,2) DEFAULT NULL,
  `estado_id` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `numero_orden` (`numero_orden`),
  KEY `cliente_id` (`cliente_id`),
  KEY `estado_id` (`estado_id`),
  CONSTRAINT `orden_ibfk_1` FOREIGN KEY (`cliente_id`) REFERENCES `cliente` (`id`),
  CONSTRAINT `orden_ibfk_2` FOREIGN KEY (`estado_id`) REFERENCES `estado` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `orden`
--

LOCK TABLES `orden` WRITE;
/*!40000 ALTER TABLE `orden` DISABLE KEYS */;
INSERT INTO `orden` VALUES (1,1,'ORD-002','2026-05-05 02:27:41',20000.00,1),(2,2,'ORD-003','2026-05-05 02:27:41',30000.00,1),(3,3,'ORD-004','2026-05-05 02:27:41',40000.00,1);
/*!40000 ALTER TABLE `orden` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `orden_item`
--

DROP TABLE IF EXISTS `orden_item`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `orden_item` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `orden_id` bigint unsigned DEFAULT NULL,
  `producto_id` bigint unsigned DEFAULT NULL,
  `cantidad` int DEFAULT NULL,
  `precio` decimal(12,2) DEFAULT NULL,
  `subtotal` decimal(12,2) DEFAULT NULL,
  `estado_id` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `orden_id` (`orden_id`),
  KEY `producto_id` (`producto_id`),
  KEY `estado_id` (`estado_id`),
  CONSTRAINT `orden_item_ibfk_1` FOREIGN KEY (`orden_id`) REFERENCES `orden` (`id`),
  CONSTRAINT `orden_item_ibfk_2` FOREIGN KEY (`producto_id`) REFERENCES `producto` (`id`),
  CONSTRAINT `orden_item_ibfk_3` FOREIGN KEY (`estado_id`) REFERENCES `estado` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `orden_item`
--

LOCK TABLES `orden_item` WRITE;
/*!40000 ALTER TABLE `orden_item` DISABLE KEYS */;
/*!40000 ALTER TABLE `orden_item` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `pago`
--

DROP TABLE IF EXISTS `pago`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `pago` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `orden_id` bigint unsigned DEFAULT NULL,
  `metodo_pago_id` bigint unsigned DEFAULT NULL,
  `monto` decimal(12,2) DEFAULT NULL,
  `fecha` datetime DEFAULT CURRENT_TIMESTAMP,
  `estado_id` bigint unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `orden_id` (`orden_id`),
  KEY `metodo_pago_id` (`metodo_pago_id`),
  KEY `estado_id` (`estado_id`),
  CONSTRAINT `pago_ibfk_1` FOREIGN KEY (`orden_id`) REFERENCES `orden` (`id`),
  CONSTRAINT `pago_ibfk_2` FOREIGN KEY (`metodo_pago_id`) REFERENCES `metodo_pago` (`id`),
  CONSTRAINT `pago_ibfk_3` FOREIGN KEY (`estado_id`) REFERENCES `estado` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `pago`
--

LOCK TABLES `pago` WRITE;
/*!40000 ALTER TABLE `pago` DISABLE KEYS */;
/*!40000 ALTER TABLE `pago` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `persona`
--

DROP TABLE IF EXISTS `persona`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `persona` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `tipo_documento_id` bigint unsigned DEFAULT NULL,
  `numero_documento` varchar(50) DEFAULT NULL,
  `primer_nombre` varchar(100) DEFAULT NULL,
  `segundo_nombre` varchar(100) DEFAULT NULL,
  `primer_apellido` varchar(100) DEFAULT NULL,
  `segundo_apellido` varchar(100) DEFAULT NULL,
  `correo` varchar(150) DEFAULT NULL,
  `telefono` varchar(30) DEFAULT NULL,
  `fecha_nacimiento` date DEFAULT NULL,
  `estado_id` bigint unsigned DEFAULT NULL,
  `creado_por` bigint unsigned DEFAULT NULL,
  `creado_en` datetime DEFAULT CURRENT_TIMESTAMP,
  `actualizado_por` bigint unsigned DEFAULT NULL,
  `actualizado_en` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `eliminado_por` bigint unsigned DEFAULT NULL,
  `eliminado_en` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `correo` (`correo`),
  KEY `tipo_documento_id` (`tipo_documento_id`),
  KEY `estado_id` (`estado_id`),
  CONSTRAINT `persona_ibfk_1` FOREIGN KEY (`tipo_documento_id`) REFERENCES `tipo_documento` (`id`),
  CONSTRAINT `persona_ibfk_2` FOREIGN KEY (`estado_id`) REFERENCES `estado` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `persona`
--

LOCK TABLES `persona` WRITE;
/*!40000 ALTER TABLE `persona` DISABLE KEYS */;
INSERT INTO `persona` VALUES (1,1,'123','Lui',NULL,'Dev',NULL,'lui@test.com',NULL,NULL,1,NULL,'2026-05-05 02:12:41',NULL,'2026-05-05 02:12:41',NULL,NULL),(2,1,'456','Carlos',NULL,'Perez',NULL,'carlos@test.com',NULL,NULL,1,NULL,'2026-05-05 02:27:41',NULL,'2026-05-05 02:27:41',NULL,NULL),(3,1,'789','Ana',NULL,'Gomez',NULL,'ana@test.com',NULL,NULL,1,NULL,'2026-05-05 02:27:41',NULL,'2026-05-05 02:27:41',NULL,NULL),(4,1,'101','Luis',NULL,'Martinez',NULL,'luis@test.com',NULL,NULL,1,NULL,'2026-05-05 02:27:41',NULL,'2026-05-05 02:27:41',NULL,NULL);
/*!40000 ALTER TABLE `persona` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `producto`
--

DROP TABLE IF EXISTS `producto`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `producto` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(200) DEFAULT NULL,
  `descripcion` text,
  `precio` decimal(12,2) DEFAULT NULL,
  `estado_id` bigint unsigned DEFAULT NULL,
  `creado_por` bigint unsigned DEFAULT NULL,
  `creado_en` datetime DEFAULT CURRENT_TIMESTAMP,
  `actualizado_por` bigint unsigned DEFAULT NULL,
  `actualizado_en` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `eliminado_por` bigint unsigned DEFAULT NULL,
  `eliminado_en` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `estado_id` (`estado_id`),
  CONSTRAINT `producto_ibfk_1` FOREIGN KEY (`estado_id`) REFERENCES `estado` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `producto`
--

LOCK TABLES `producto` WRITE;
/*!40000 ALTER TABLE `producto` DISABLE KEYS */;
INSERT INTO `producto` VALUES (1,'Producto 1',NULL,10000.00,1,NULL,'2026-05-05 02:12:41',NULL,'2026-05-05 02:12:41',NULL,NULL),(2,'Producto 2',NULL,20000.00,1,NULL,'2026-05-05 02:27:41',NULL,'2026-05-05 02:27:41',NULL,NULL),(3,'Producto 3',NULL,30000.00,1,NULL,'2026-05-05 02:27:41',NULL,'2026-05-05 02:27:41',NULL,NULL),(4,'Producto 4',NULL,40000.00,1,NULL,'2026-05-05 02:27:41',NULL,'2026-05-05 02:27:41',NULL,NULL);
/*!40000 ALTER TABLE `producto` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `stock`
--

DROP TABLE IF EXISTS `stock`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `stock` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `producto_id` bigint unsigned DEFAULT NULL,
  `cantidad` int DEFAULT '0',
  PRIMARY KEY (`id`),
  UNIQUE KEY `producto_id` (`producto_id`),
  CONSTRAINT `stock_ibfk_1` FOREIGN KEY (`producto_id`) REFERENCES `producto` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `stock`
--

LOCK TABLES `stock` WRITE;
/*!40000 ALTER TABLE `stock` DISABLE KEYS */;
INSERT INTO `stock` VALUES (1,1,10),(2,2,20),(3,3,30),(4,4,40);
/*!40000 ALTER TABLE `stock` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `tipo_documento`
--

DROP TABLE IF EXISTS `tipo_documento`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `tipo_documento` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `codigo` varchar(20) NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `descripcion` text,
  `estado_id` bigint unsigned DEFAULT NULL,
  `creado_por` bigint unsigned DEFAULT NULL,
  `creado_en` datetime DEFAULT CURRENT_TIMESTAMP,
  `actualizado_por` bigint unsigned DEFAULT NULL,
  `actualizado_en` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `eliminado_por` bigint unsigned DEFAULT NULL,
  `eliminado_en` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `codigo` (`codigo`),
  KEY `estado_id` (`estado_id`),
  CONSTRAINT `tipo_documento_ibfk_1` FOREIGN KEY (`estado_id`) REFERENCES `estado` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `tipo_documento`
--

LOCK TABLES `tipo_documento` WRITE;
/*!40000 ALTER TABLE `tipo_documento` DISABLE KEYS */;
INSERT INTO `tipo_documento` VALUES (1,'CC','Cedula',NULL,1,NULL,'2026-05-05 02:12:41',NULL,'2026-05-05 02:12:41',NULL,NULL),(2,'TI','Tarjeta Identidad',NULL,1,NULL,'2026-05-05 02:27:41',NULL,'2026-05-05 02:27:41',NULL,NULL),(3,'NIT','NIT',NULL,1,NULL,'2026-05-05 02:27:41',NULL,'2026-05-05 02:27:41',NULL,NULL);
/*!40000 ALTER TABLE `tipo_documento` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-05-04 21:37:23
