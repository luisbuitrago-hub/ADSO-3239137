CREATE DATABASE vuelos;
GO
USE vuelos;
GO

CREATE TABLE aerolineas(id_aerolinea INT IDENTITY PRIMARY KEY,nombre VARCHAR(100));
CREATE TABLE aviones(id_avion INT IDENTITY PRIMARY KEY,modelo VARCHAR(100),id_aerolinea INT FOREIGN KEY REFERENCES aerolineas(id_aerolinea));
CREATE TABLE aeropuertos(id_aeropuerto INT IDENTITY PRIMARY KEY,nombre VARCHAR(100));
CREATE TABLE vuelos(id_vuelo INT IDENTITY PRIMARY KEY,id_avion INT,id_origen INT,id_destino INT,fecha DATE,
FOREIGN KEY(id_avion) REFERENCES aviones(id_avion));
CREATE TABLE boletos(id_boleto INT IDENTITY PRIMARY KEY,id_vuelo INT,pasajero VARCHAR(100),FOREIGN KEY(id_vuelo) REFERENCES vuelos(id_vuelo));

-- INSERTS
INSERT INTO aerolineas(nombre) VALUES('LATAM'),('Avianca'),('Copa'),('Iberia'),('Delta');
INSERT INTO aviones(modelo,id_aerolinea) VALUES('A320',1),('A330',2),('B737',3),('B787',4),('A350',5);
INSERT INTO aeropuertos(nombre) VALUES('BOG'),('MDE'),('CLO'),('JFK'),('MAD');
INSERT INTO vuelos(id_avion,id_origen,id_destino,fecha) VALUES(1,1,2,'2024-01-01'),(2,2,3,'2024-01-02'),(3,3,4,'2024-01-03'),(4,4,5,'2024-01-04'),(5,5,1,'2024-01-05');
INSERT INTO boletos(id_vuelo,pasajero) VALUES(1,'Ana'),(2,'Luis'),(3,'Carlos'),(4,'Marta'),(5,'Jose');

-- UPDATES
UPDATE aerolineas SET nombre='LATAM AIR' WHERE id_aerolinea=1;
UPDATE aerolineas SET nombre='Copa Airlines' WHERE id_aerolinea=3;
UPDATE aviones SET modelo='A321' WHERE id_avion=1;
UPDATE aviones SET id_aerolinea=2 WHERE id_avion=3;
UPDATE aeropuertos SET nombre='BOGOTA' WHERE id_aeropuerto=1;
UPDATE aeropuertos SET nombre='MEDELLIN' WHERE id_aeropuerto=2;
UPDATE vuelos SET fecha='2024-02-01' WHERE id_vuelo=1;
UPDATE vuelos SET id_destino=5 WHERE id_vuelo=2;
UPDATE boletos SET pasajero='Maria' WHERE id_boleto=1;
UPDATE boletos SET id_vuelo=3 WHERE id_boleto=2;

-- DELETES
DELETE FROM boletos WHERE id_boleto IN(4,5);
DELETE FROM vuelos WHERE id_vuelo IN(4,5);
DELETE FROM aviones WHERE id_avion IN(4,5);
DELETE FROM aerolineas WHERE id_aerolinea IN(4,5);
DELETE FROM aeropuertos WHERE id_aeropuerto IN(4,5);

-- SELECTS
SELECT * FROM aerolineas WHERE id_aerolinea<=3;
SELECT * FROM aviones WHERE id_aerolinea=2;
SELECT * FROM aeropuertos WHERE nombre LIKE 'B%';
SELECT * FROM vuelos WHERE fecha>'2024-01-01';
SELECT * FROM boletos WHERE id_vuelo=1;

-- JOINS
SELECT v.id_vuelo,a.modelo,al.nombre FROM vuelos v
JOIN aviones a ON v.id_avion=a.id_avion
JOIN aerolineas al ON a.id_aerolinea=al.id_aerolinea;

SELECT p.pasajero,ap.nombre AS origen FROM boletos p
JOIN vuelos v ON p.id_vuelo=v.id_vuelo
JOIN aeropuertos ap ON v.id_origen=ap.id_aeropuerto;
