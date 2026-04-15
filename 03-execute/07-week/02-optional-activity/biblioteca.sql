CREATE DATABASE biblioteca;
\c biblioteca;

CREATE TABLE autores(id_autor SERIAL PRIMARY KEY,nombre TEXT);
CREATE TABLE libros(id_libro SERIAL PRIMARY KEY,titulo TEXT,id_autor INT REFERENCES autores(id_autor));
CREATE TABLE usuarios(id_usuario SERIAL PRIMARY KEY,nombre TEXT);
CREATE TABLE prestamos(id_prestamo SERIAL PRIMARY KEY,id_usuario INT REFERENCES usuarios(id_usuario),fecha DATE);
CREATE TABLE prestamo_detalle(id_detalle SERIAL PRIMARY KEY,id_prestamo INT REFERENCES prestamos(id_prestamo),id_libro INT REFERENCES libros(id_libro));

-- INSERTS
INSERT INTO autores(nombre) VALUES('Autor1'),('Autor2'),('Autor3'),('Autor4'),('Autor5');
INSERT INTO libros(titulo,id_autor) VALUES('Libro1',1),('Libro2',2),('Libro3',3),('Libro4',4),('Libro5',5);
INSERT INTO usuarios(nombre) VALUES('U1'),('U2'),('U3'),('U4'),('U5');
INSERT INTO prestamos(id_usuario,fecha) VALUES(1,'2024-01-01'),(2,'2024-01-02'),(3,'2024-01-03'),(4,'2024-01-04'),(5,'2024-01-05');
INSERT INTO prestamo_detalle(id_prestamo,id_libro) VALUES(1,1),(2,2),(3,3),(4,4),(5,5);

-- UPDATES
UPDATE autores SET nombre='Autor1X' WHERE id_autor=1;
UPDATE autores SET nombre='Autor2X' WHERE id_autor=2;
UPDATE libros SET titulo='Libro1X' WHERE id_libro=1;
UPDATE libros SET id_autor=3 WHERE id_libro=2;
UPDATE usuarios SET nombre='User1' WHERE id_usuario=1;
UPDATE usuarios SET nombre='User2' WHERE id_usuario=2;
UPDATE prestamos SET fecha='2024-02-02' WHERE id_prestamo=1;
UPDATE prestamos SET id_usuario=3 WHERE id_prestamo=2;
UPDATE prestamo_detalle SET id_libro=2 WHERE id_detalle=1;
UPDATE prestamo_detalle SET id_prestamo=3 WHERE id_detalle=2;

-- DELETES
DELETE FROM prestamo_detalle WHERE id_detalle IN(4,5);
DELETE FROM prestamos WHERE id_prestamo IN(4,5);
DELETE FROM libros WHERE id_libro IN(4,5);
DELETE FROM usuarios WHERE id_usuario IN(4,5);
DELETE FROM autores WHERE id_autor IN(4,5);

-- SELECTS
SELECT * FROM autores WHERE id_autor<=3;
SELECT * FROM libros WHERE id_autor=3;
SELECT * FROM usuarios WHERE nombre LIKE 'U%';
SELECT * FROM prestamos WHERE fecha>'2024-01-01';
SELECT * FROM prestamo_detalle WHERE id_prestamo=1;

-- JOINS
SELECT u.nombre,l.titulo FROM prestamos p
JOIN usuarios u ON p.id_usuario=u.id_usuario
JOIN prestamo_detalle pd ON p.id_prestamo=pd.id_prestamo
JOIN libros l ON pd.id_libro=l.id_libro;

SELECT a.nombre,COUNT(l.id_libro) FROM autores a
JOIN libros l ON a.id_autor=l.id_autor GROUP BY a.nombre;
