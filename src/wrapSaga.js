export default function wrapSaga(module, methods) {
  const newModule = Object.assign({}, module)

  methods.map(methodName => {
    newModule[methodName] = (pattern, ...args) => {
      if (typeof pattern.toString === 'function' && typeof pattern.getType === 'function') {
        pattern = pattern.getType()
      }
      return module[methodName](pattern, ...args)
    }
  })

  return newModule
}
