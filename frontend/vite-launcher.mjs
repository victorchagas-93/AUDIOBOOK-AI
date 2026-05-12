import childProcess from "node:child_process"
import { syncBuiltinESMExports } from "node:module"
import { EventEmitter } from "node:events"

const originalExec = childProcess.exec.bind(childProcess)

function runNetUse(callback) {
  const child = new EventEmitter()
  child.stdout = new EventEmitter()
  child.stderr = new EventEmitter()
  child.stdin = new EventEmitter()
  child.kill = () => true

  process.nextTick(() => {
    callback?.(null, "", "")
    child.stdout.emit("end")
    child.emit("close", 0)
  })

  return child
}

childProcess.exec = function patchedExec(command, ...args) {
  if (typeof command === "string" && command.trim().toLowerCase() === "net use") {
    const callback = typeof args.at(-1) === "function" ? args.pop() : undefined
    return runNetUse(callback)
  }

  return originalExec(command, ...args)
}

syncBuiltinESMExports()

await import("./node_modules/vite/bin/vite.js")
