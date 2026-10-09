import type {Address} from './checkout-types'
import {countries, regions, postcodeOptional} from './destinations'
type Props = {value: Address; prefix: string; onChange: (value: Address) => void; errors: Record<string, string>}
export const emptyAddress = (): Address => ({name: '', line1: '', line2: '', city: '', postalCode: '', country: 'DE', state: ''})
export default function AddressFields({value, prefix, onChange, errors}: Props) {
  function field(key: keyof Address, label: string, required = true, autoComplete?: string) {
    const id = `${prefix}-${key}`
    return <label htmlFor={id}>{label}<input id={id} value={value[key]} onChange={event => onChange({...value, [key]: event.target.value})} required={required} autoComplete={autoComplete} maxLength={key === 'postalCode' ? 20 : 150} aria-invalid={!!errors[`${prefix}.${key}`]} aria-describedby={errors[`${prefix}.${key}`] ? `${id}-error` : undefined} />{errors[`${prefix}.${key}`] && <small id={`${id}-error`} className="shop-field-error">{errors[`${prefix}.${key}`]}</small>}</label>
  }
  return <>
    {field('name', 'Full name', true, `${prefix === 'billing' ? 'billing' : 'shipping'} name`)}
    <label htmlFor={`${prefix}-country`}>Country / region<select id={`${prefix}-country`} value={value.country} onChange={event => onChange({...value, country: event.target.value, state: '', postalCode: ''})} autoComplete={`${prefix === 'billing' ? 'billing' : 'shipping'} country`} aria-invalid={!!errors[`${prefix}.country`]}>{countries.map(country => <option key={country.code} value={country.code}>{country.name}</option>)}</select>{errors[`${prefix}.country`] && <small className="shop-field-error">{errors[`${prefix}.country`]}</small>}</label>
    {field('line1', 'Street address', true, `${prefix === 'billing' ? 'billing' : 'shipping'} address-line1`)}
    {field('line2', 'Apartment, suite, etc. (optional)', false, `${prefix === 'billing' ? 'billing' : 'shipping'} address-line2`)}
    <div className="shop-demo-fields">{field('city', 'City', true, `${prefix === 'billing' ? 'billing' : 'shipping'} address-level2`)}{field('postalCode', postcodeOptional.has(value.country) ? 'Postal code (optional)' : 'Postal code', !postcodeOptional.has(value.country), `${prefix === 'billing' ? 'billing' : 'shipping'} postal-code`)}</div>
    {regions[value.country] ? <label htmlFor={`${prefix}-state`}>State / province<select id={`${prefix}-state`} value={value.state} onChange={event => onChange({...value, state: event.target.value})} required aria-invalid={!!errors[`${prefix}.state`]}><option value="">Select a state or province</option>{regions[value.country].map(region => <option key={region.code} value={region.code}>{region.name}</option>)}</select>{errors[`${prefix}.state`] && <small className="shop-field-error">{errors[`${prefix}.state`]}</small>}</label> : field('state', 'State / province (optional)', false)}
  </>
}
