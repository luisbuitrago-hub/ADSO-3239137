<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UploadCoverRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return ['file' => ['required', 'file', 'max:2048']];
    }

    public function messages(): array
    {
        return ['required' => 'Debes proporcionar una imagen.', 'file' => 'El archivo no pudo cargarse correctamente.',
            'max' => 'La imagen no puede superar 2 MB.', 'uploaded' => 'El archivo no pudo cargarse correctamente.'];
    }
}
