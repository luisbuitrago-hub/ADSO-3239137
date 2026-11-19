FROM php:8.4-apache-bookworm AS base

RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq-dev libonig-dev libsqlite3-dev libxml2-dev unzip gosu \
    && docker-php-ext-install -j2 pdo_pgsql pdo_sqlite mbstring pcntl \
    && php -r 'foreach (["pdo_pgsql", "sodium", "fileinfo", "mbstring", "dom", "pdo_sqlite", "pcntl"] as $ext) { if (!extension_loaded($ext)) { fwrite(STDERR, "Missing extension: $ext\n"); exit(1); } }' \
    && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/local/bin/composer
COPY infra/docker/apache.conf /etc/apache2/sites-available/000-default.conf
COPY infra/docker/php.ini /usr/local/etc/php/conf.d/kitchenware.ini
RUN sed -i 's/Listen 80/Listen 8080/' /etc/apache2/ports.conf \
    && printf 'ServerName localhost\n' > /etc/apache2/conf-available/servername.conf \
    && a2enconf servername \
    && mkdir -p /tmp/apache2/run /tmp/apache2/log /tmp/apache2/lock \
    && chown -R www-data:www-data /tmp/apache2

ENV APACHE_RUN_DIR=/tmp/apache2/run \
    APACHE_PID_FILE=/tmp/apache2/run/apache2.pid \
    APACHE_LOG_DIR=/tmp/apache2/log \
    APACHE_LOCK_DIR=/tmp/apache2/lock
WORKDIR /var/www/html
EXPOSE 8080

FROM base AS dependencies
ENV COMPOSER_ALLOW_SUPERUSER=1
COPY api/composer.json api/composer.lock ./
RUN composer install --no-dev --prefer-dist --no-interaction --no-progress --no-scripts --no-autoloader
COPY api/ ./
RUN mkdir -p bootstrap/cache storage/framework/cache/data storage/framework/sessions storage/framework/views storage/logs storage/app/private \
    && composer dump-autoload --no-dev --optimize --no-scripts \
    && php artisan package:discover --ansi

FROM dependencies AS testing
RUN composer install --prefer-dist --no-interaction --no-progress --no-scripts \
    && php artisan package:discover --ansi
COPY --chmod=755 infra/docker/test-entrypoint.sh /usr/local/bin/kitchenware-test-entrypoint
ENTRYPOINT ["kitchenware-test-entrypoint"]
CMD ["composer", "test"]

FROM base AS runtime
COPY --from=dependencies /var/www/html /var/www/html
COPY infra/docker/entrypoint.sh /usr/local/bin/kitchenware-entrypoint
COPY infra/docker/preflight.php infra/docker/healthcheck.php /usr/local/lib/kitchenware/
RUN chmod 755 /usr/local/bin/kitchenware-entrypoint \
    && mkdir -p /var/lib/kitchenware/covers \
    && chmod 700 /var/lib/kitchenware/covers \
    && chown -R www-data:www-data storage bootstrap/cache /var/lib/kitchenware
USER www-data
ENTRYPOINT ["kitchenware-entrypoint"]
CMD ["apache2-foreground"]
