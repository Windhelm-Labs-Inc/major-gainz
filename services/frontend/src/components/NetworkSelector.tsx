import React from 'react'

type HederaNetwork = 'mainnet' | 'testnet'

interface Props {
  value: HederaNetwork
  onChange: (net: HederaNetwork) => void
}

const NetworkSelector: React.FC<Props> = ({ value, onChange }) => {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <label htmlFor="network-select" style={{ marginRight: '0.5rem' }}>
        Hedera Network:
      </label>
      <select
        id="network-select"
        value={value}
        onChange={e => onChange(e.target.value as HederaNetwork)}
      >
        <option value="testnet">Testnet</option>
        <option value="mainnet">Mainnet</option>
      </select>
    </div>
  )
}

export default NetworkSelector 