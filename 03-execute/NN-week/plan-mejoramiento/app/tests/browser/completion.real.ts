import { test } from '@playwright/test'
import { completionFlow } from './completion-flow'
test('imágenes, reporte histórico y operadores con Laravel/PostgreSQL aislados', async ({
  page,
  request,
}) => completionFlow(page, request))
