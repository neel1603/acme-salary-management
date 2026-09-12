import { apiFetch } from './client'

function mapCountry(wire) {
  return {
    id: wire.id,
    code: wire.code,
    name: wire.name,
    currencyCode: wire.currency_code,
  }
}

function mapDepartment(wire) {
  return {
    id: wire.id,
    name: wire.name,
  }
}

export async function fetchCountries() {
  const wire = await apiFetch('/countries')
  return wire.map(mapCountry)
}

export async function fetchDepartments() {
  const wire = await apiFetch('/departments')
  return wire.map(mapDepartment)
}
