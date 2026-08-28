const delay = milliseconds => new Promise(resolve => {
  setTimeout(resolve, milliseconds)
})

class ElectronCdpTestClient {
  constructor(url) {
    this.url = url
    this.nextId = 1
    this.pending = new Map()
    this.errors = []
  }

  async connect() {
    this.socket = new WebSocket(this.url)
    await new Promise((resolve, reject) => {
      this.socket.addEventListener('open', resolve, { once: true })
      this.socket.addEventListener('error', reject, { once: true })
    })
    this.socket.addEventListener('message', event => {
      const message = JSON.parse(String(event.data))
      if (message.id) {
        const pending = this.pending.get(message.id)
        if (!pending) return
        this.pending.delete(message.id)
        if (message.error) pending.reject(new Error(message.error.message))
        else pending.resolve(message.result)
      } else if (message.method === 'Runtime.exceptionThrown') {
        const detail = message.params.exceptionDetails
        this.errors.push(detail.exception?.description || detail.text)
      }
    })
    await this.send('Runtime.enable')
  }

  send(method, params = {}) {
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject })
      this.socket.send(JSON.stringify({ id, method, params }))
    })
  }

  async evaluate(expression) {
    const response = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    })
    if (response.exceptionDetails) {
      throw new Error(
        response.exceptionDetails.exception?.description
        || response.exceptionDetails.text,
      )
    }
    return response.result.value
  }

  close() {
    this.socket.close()
  }
}

async function waitFor(action, label, timeout = 20000) {
  const deadline = Date.now() + timeout
  let lastValue
  while (Date.now() < deadline) {
    lastValue = await action()
    if (lastValue) return lastValue
    await delay(250)
  }
  throw new Error(
    `等待超时: ${label}; 最后结果=${JSON.stringify(lastValue)}`,
  )
}

module.exports = {
  delay,
  ElectronCdpTestClient,
  waitFor,
}
