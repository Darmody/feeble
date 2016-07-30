import typeSet from './typeSet'
import { CALL_API, NAMESPACE_PATTERN } from './constants'
import { createSelector, createStructuredSelector } from 'reselect'
import invariant from 'invariant'
import composeReducers from './composeReducers'
import { is } from './utils'

const identity = (arg) => arg

const invariantReducer = (value, name) => {
  invariant(
    is.undef(value) || is.func(value),
    '%s should be a function',
    name
  )
}

function model(options) {
  invariant(
    is.namespace(options.namespace),
    '%s is not a valid namespace, namespace should be a string ' +
    'and match the pattern %s',
    options.namespace,
    NAMESPACE_PATTERN
  )

  const _initialState = options.state
  let _state = _initialState
  let _model = {}
  let _effect = null
  const _namespace = options.namespace
  const _selectors = {}
  const _reducers = [
    (state = _state) => state,
  ]

  function action(type, payloadReducer, metaReducer) {
    invariantReducer(payloadReducer, 'payload reducer')
    invariantReducer(metaReducer, 'meta reducer')

    if (typeof payloadReducer === 'undefined') {
      payloadReducer = identity
    }

    const fullType = [_namespace, type].join('::')

    invariant(
      !typeSet.has(fullType),
      '%s has already token by another action',
      fullType
    )

    typeSet.add(fullType)

    function actionCreator(...args) {
      const action = { type: fullType }

      action.payload = payloadReducer(...args)

      if (metaReducer) {
        action.meta = metaReducer(...args)
      }

      return action
    }

    actionCreator.getType = () => fullType
    actionCreator.toString = () => fullType

    _model[type] = actionCreator

    return actionCreator
  }

  function apiAction(type, requestReducer, metaReducer) {
    invariantReducer(requestReducer, 'request reducer')
    invariantReducer(metaReducer, 'meta reducer')

    const suffixes = ['request', 'success', 'error']

    const types = suffixes.map(suffix => [_namespace, `${type}_${suffix}`].join('::'))

    function apiActionCreator(...args) {
      const request = requestReducer(...args)
      const action = {
        [CALL_API]: {
          types,
          ...request,
        },
      }
      if (metaReducer) {
        action.meta = metaReducer(...args)
      }
      Object.defineProperty(action, 'getRequest', { value: () => request })
      return action
    }

    suffixes.forEach((suffix, index) => {
      const type = types[index]

      invariant(
        !typeSet.has(type),
        '%s has already token by another action',
        type
      )

      typeSet.add(type)

      apiActionCreator[suffix] = (payload, meta) => ({ type, payload, meta })
      apiActionCreator[suffix].toString = () => type
      apiActionCreator[suffix].getType = () => type
    })

    _model[type] = apiActionCreator

    return apiActionCreator
  }

  function reducer(handlers = {}, enhancer = identity) {
    const patternHandlers = []

    function on(pattern, handler) {
      if (typeof pattern === 'string') {
        handlers[pattern] = handler
      } else if (is.actionCreator(pattern)) {
        handlers[pattern.getType()] = handler
      } else if (Array.isArray(pattern)) {
        pattern.forEach(p => on(p, handler))
      } else if (typeof pattern === 'function') {
        patternHandlers.push({
          pattern,
          handler,
        })
      }
    }

    if (typeof handlers === 'function') {
      const factory = handlers
      handlers = {}
      factory(on)
    }

    let reduce = (state = _initialState, action) => {
      if (action && handlers[action.type]) {
        return handlers[action.type](state, action.payload, action.meta)
      }
      for (const { pattern, handler } of patternHandlers) {
        if (pattern(action)) {
          return handler(state, action.payload, action.meta)
        }
      }
      return state
    }

    reduce = enhancer(reduce)

    _reducers.push(reduce)

    return reduce
  }

  function selector(name, ...funcs) {
    _selectors[name] = createSelector(...funcs)
  }

  function structuredSelctor(name, selectors) {
    _selectors[name] = createStructuredSelector(selectors)
  }

  function select(name, ...args) {
    return _selectors[name](...args)
  }

  function effect(effect) {
    _effect = effect
    return _effect
  }

  function getNamespace() {
    return _namespace
  }

  function setReducer(reducer) {
    _reducers.push(reducer)
    return reducer
  }

  function getReducer() {
    const reducer = composeReducers(_reducers)
    return (state, action) => {
      const nextState = reducer(state, action)
      _state = nextState
      return nextState
    }
  }

  function getEffect() {
    return _effect
  }

  function getState() {
    return _state
  }

  _model = {
    action,
    apiAction,
    reducer,
    selector,
    structuredSelctor,
    select,
    effect,
    getNamespace,
    setReducer,
    getReducer,
    getEffect,
    getState,
  }

  return _model
}

export default model
