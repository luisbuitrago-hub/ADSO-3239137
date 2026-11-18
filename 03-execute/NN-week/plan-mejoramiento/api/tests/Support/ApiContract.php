<?php

namespace Tests\Support;

final class ApiContract
{
    /** null = público, admin = administrador, ambos = admin y operator. */
    public const ENDPOINTS = [
        'POST api/v1/auth/login' => null, 'GET api/v1/health' => null,
        'POST api/v1/users' => 'admin', 'GET api/v1/categories' => 'both',
        'GET api/v1/articles' => 'both', 'GET api/v1/articles/{id}' => 'both',
        'POST api/v1/articles' => 'admin', 'PUT api/v1/articles/{id}' => 'admin', 'DELETE api/v1/articles/{id}' => 'admin',
        'PUT api/v1/articles/{id}/cover' => 'admin', 'DELETE api/v1/articles/{id}/cover' => 'admin', 'GET api/v1/articles/{id}/cover' => 'both',
        'GET api/v1/neighbors' => 'both', 'GET api/v1/neighbors/{id}' => 'both', 'POST api/v1/neighbors' => 'both',
        'POST api/v1/loans' => 'both', 'GET api/v1/loans' => 'both', 'GET api/v1/loans/{id}' => 'both',
        'POST api/v1/loans/{loan_id}/items/{item_id}/return' => 'both', 'GET api/v1/loans/overdue' => 'both',
        'GET api/v1/reports/most-borrowed' => 'admin',
    ];
}
