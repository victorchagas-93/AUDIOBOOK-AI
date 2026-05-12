import fetch from 'node-fetch'

async function main() {
  const res = await fetch('http://localhost:3000/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Origin': 'http://localhost:5175' },
    body: JSON.stringify({ email: 'test@example.com', password: 'password123' })
  })

  const text = await res.text()
  console.log('Status:', res.status)
  console.log('Body:', text)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
