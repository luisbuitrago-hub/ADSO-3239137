CREATE DATABASE carrito_mysql;
INSERT INTO categorias(nombre) VALUES ('Tecnologia'),('Oficina'),('Accesorios'),('Audio'),('Video');

INSERT INTO ordenes(id_cliente,fecha) VALUES
(1,'2024-01-01'),(2,'2024-01-02'),(3,'2024-01-03'),(4,'2024-01-04'),(5,'2024-01-05');

INSERT INTO orden_detalle(id_orden,id_producto,cantidad) VALUES
(1,1,2),(2,2,1),(3,3,1),(4,4,3),(5,5,2);

-- UPDATES (2 por tabla)
UPDATE clientes SET nombre='Ana Maria' WHERE id_cliente=1;
UPDATE clientes SET email='nuevo@mail.com' WHERE id_cliente=2;

UPDATE productos SET precio=21000 WHERE id_producto=1;
UPDATE productos SET nombre='Monitor 24' WHERE id_producto=3;

UPDATE categorias SET nombre='Tecnologia y Gadgets' WHERE id_categoria=1;
UPDATE categorias SET nombre='Sonido' WHERE id_categoria=4;

UPDATE ordenes SET fecha='2024-02-01' WHERE id_orden=1;
UPDATE ordenes SET id_cliente=3 WHERE id_orden=2;

UPDATE orden_detalle SET cantidad=5 WHERE id_detalle=1;
UPDATE orden_detalle SET id_producto=4 WHERE id_detalle=2;

-- DELETES (2 por tabla)
DELETE FROM orden_detalle WHERE id_detalle=5;
DELETE FROM orden_detalle WHERE id_detalle=4;

DELETE FROM ordenes WHERE id_orden=5;
DELETE FROM ordenes WHERE id_orden=4;

DELETE FROM productos WHERE id_producto=5;
DELETE FROM productos WHERE id_producto=4;

DELETE FROM categorias WHERE id_categoria=5;
DELETE FROM categorias WHERE id_categoria=4;

DELETE FROM clientes WHERE id_cliente=5;
DELETE FROM clientes WHERE id_cliente=4;

-- SELECTS
SELECT * FROM clientes WHERE id_cliente=1;
SELECT * FROM productos WHERE precio>20000;
SELECT * FROM categorias WHERE id_categoria<=3;
SELECT * FROM ordenes WHERE fecha>'2024-01-01';
SELECT * FROM orden_detalle WHERE cantidad>1;

-- JOINS
SELECT o.id_orden,c.nombre,p.nombre FROM ordenes o
JOIN clientes c ON o.id_cliente=c.id_cliente
JOIN orden_detalle od ON o.id_orden=od.id_orden
JOIN productos p ON od.id_producto=p.id_producto;

SELECT c.nombre,COUNT(o.id_orden) AS total_ordenes FROM clientes c
JOIN ordenes o ON c.id_cliente=o.id_cliente
GROUP BY c.nombre;