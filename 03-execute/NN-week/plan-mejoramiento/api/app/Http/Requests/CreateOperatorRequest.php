<?php

namespace App\Http\Requests;

class CreateOperatorRequest extends LoginRequest
{
    public function rules(): array
    {
        return array_merge(parent::rules(), [
            'role' => ['required', 'string', 'in:operator'],
            'password' => ['required', 'string', function (string $attribute, mixed $value, \Closure $fail): void {
                if (is_string($value) && strlen($value) > 72) {
                    $fail('La contraseña no puede superar 72 bytes.');
                }
            }],
        ]);
    }
}
