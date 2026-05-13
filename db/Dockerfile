FROM postgres:16-alpine
# Postgres ejecuta TODO archivo .sql que encuentre en este path,
# la primera vez que arranca con un volumen vacio.
COPY init.sql /docker-entrypoint-initdb.d/01-init.sql
EXPOSE 5432