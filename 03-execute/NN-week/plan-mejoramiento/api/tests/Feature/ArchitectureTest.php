<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Storage;
use ReflectionClass;
use Tests\TestCase;

class ArchitectureTest extends TestCase
{
    private function files(string $directory): array
    {
        $paths = [];
        foreach (new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($directory, \FilesystemIterator::SKIP_DOTS)) as $file) {
            if ($file->getExtension() === 'php') {
                $paths[] = $file->getPathname();
            }
        }

        return $paths;
    }

    public function test_domain_and_application_do_not_depend_on_framework_database_or_adapters(): void
    {
        $violations = [];
        foreach (['Domain', 'Application'] as $layer) {
            foreach ($this->files(app_path($layer)) as $path) {
                foreach (token_get_all(file_get_contents($path)) as $token) {
                    if (! is_array($token)) {
                        continue;
                    }
                    if (in_array($token[0], [T_NAME_QUALIFIED, T_NAME_FULLY_QUALIFIED, T_STRING], true)) {
                        $name = ltrim($token[1], '\\');
                        foreach (['Illuminate\\', 'Laravel\\', 'Symfony\\', 'App\\Models\\', 'App\\Infrastructure\\', 'App\\Http\\', 'PHPOpenSourceSaver\\'] as $prefix) {
                            if (str_starts_with($name, $prefix)) {
                                $violations[] = "$path depende de $name";
                            }
                        }
                        if ($name === 'PDO') {
                            $violations[] = $path.' depende de PDO';
                        }
                    }
                }
            }
        }
        $this->assertSame([], array_values(array_unique($violations)));
    }

    public function test_all_application_ports_are_bound_to_infrastructure_implementations(): void
    {
        // Resolver adaptadores no debe acceder a almacenamiento real del entorno.
        Storage::fake('covers');
        foreach ($this->files(app_path('Application/Ports')) as $path) {
            $interface = 'App\\Application\\Ports\\'.pathinfo($path, PATHINFO_FILENAME);
            $this->assertTrue((new ReflectionClass($interface))->isInterface());
            $adapter = app($interface);
            $this->assertInstanceOf($interface, $adapter);
            $this->assertStringStartsWith('App\\Infrastructure\\', $adapter::class);
        }
    }

    public function test_controllers_do_not_access_models_or_database_facades(): void
    {
        foreach ($this->files(app_path('Http/Controllers')) as $path) {
            $contents = file_get_contents($path);
            foreach (['App\\Models\\', 'Illuminate\\Support\\Facades\\DB', 'Illuminate\\Support\\Facades\\Schema', 'App\\Infrastructure\\'] as $dependency) {
                $this->assertStringNotContainsString($dependency, $contents, $path);
            }
        }
    }
}
