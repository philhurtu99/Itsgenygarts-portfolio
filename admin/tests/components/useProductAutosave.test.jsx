import { renderHook, act } from '@testing-library/react'
import useProductAutosave from '../../src/components/useProductAutosave.js'

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())
const advance = () => act(async () => { jest.advanceTimersByTime(701) })
function setup(overrides = {}) {
  const save = jest.fn(async () => ({}))
  const props = { enabled: true, values: { nameFr: 'Initial', price: 20, stockQuantity: 2 }, save, ...overrides }
  return { ...renderHook(p => useProductAutosave(p), { initialProps: props }), props, save }
}
it('does not write on opening and debounces only modified fields', async () => {
  const { result, rerender, props, save } = setup()
  await advance(); expect(save).not.toHaveBeenCalled()
  rerender({ ...props, values: { ...props.values, nameFr: 'N' } })
  rerender({ ...props, values: { ...props.values, nameFr: 'Nouveau' } })
  await advance()
  expect(save).toHaveBeenCalledTimes(1)
  expect(save).toHaveBeenCalledWith({ nameFr: 'Nouveau' })
  expect(result.current.state).toBe('saved')
})
it('serializes edits made during an in-flight request and sends the latest value next', async () => {
  let finish
  const first = new Promise(resolve => { finish = resolve })
  const { rerender, props, save } = setup()
  save.mockImplementationOnce(() => first)
  rerender({ ...props, values: { ...props.values, nameFr: 'First' } })
  await advance()
  rerender({ ...props, values: { ...props.values, nameFr: 'Latest', price: 30 } })
  await advance(); expect(save).toHaveBeenCalledTimes(1)
  await act(async () => { finish() })
  await advance()
  expect(save.mock.calls).toEqual([[{ nameFr: 'First' }], [{ nameFr: 'Latest', price: 30 }]])
})
it('retains failures, exposes them and retries on an explicit flush', async () => {
  const { result, rerender, props, save } = setup()
  save.mockRejectedValueOnce(new Error('Hors ligne'))
  rerender({ ...props, values: { ...props.values, price: 30 } })
  await advance()
  expect(result.current).toMatchObject({ state: 'error', text: 'Non enregistré : Hors ligne' })
  await advance(); expect(save).toHaveBeenCalledTimes(1)
  await act(async () => { expect(await result.current.flush()).toBe(true) })
  expect(save).toHaveBeenCalledTimes(2)
})
it('flushes without waiting for the timer when closing', async () => {
  const { result, rerender, props, save } = setup()
  rerender({ ...props, values: { ...props.values, price: 35 } })
  await act(async () => { await result.current.flush() })
  expect(save).toHaveBeenCalledWith({ price: 35 })
})
it('waits for uploads and validation, and never autosaves a new product', async () => {
  const { result, rerender, props, save } = setup()
  const values = { ...props.values, price: 40 }
  rerender({ ...props, values, paused: true }); await advance()
  expect(save).not.toHaveBeenCalled()
  rerender({ ...props, values, validationError: 'Prix invalide' }); await advance()
  expect(result.current.text).toBe('Prix invalide')
  expect(save).not.toHaveBeenCalled()
  rerender({ ...props, values, enabled: false }); await advance()
  expect(save).not.toHaveBeenCalled()
  rerender({ ...props, values }); await advance()
  expect(save).toHaveBeenCalledWith({ price: 40 })
})
