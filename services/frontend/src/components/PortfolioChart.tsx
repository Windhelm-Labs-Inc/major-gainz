import React from 'react'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore – react-chartjs-2 may not have ESM types in this setup
import { Pie } from 'react-chartjs-2'
import type { Holding } from '../types/portfolio'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore – chart.js types sometimes missing in strict ESM projects
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'

ChartJS.register(ArcElement, Tooltip, Legend)

interface Props {
  data: Holding[]
}

const COLORS = [
  '#4dc9f6', '#f67019', '#f53794', '#537bc4',
  '#acc236', '#166a8f', '#00a950', '#58595b',
  '#8549ba', '#b82e2e', '#5b5f97', '#ffb703',
]

const PortfolioChart: React.FC<Props> = ({ data }) => {
  const priced = data.filter(h => h.usd > 0)
  if (!priced.length) return <p>No priced tokens available</p>

  const unpriced = data.filter(h => h.usd === 0).map(h => h.symbol)
  const labels = priced.map(h => `${h.symbol} ${h.percent.toFixed(1)}%`)
  const chartData = {
    labels,
    datasets: [
      {
        data: priced.map(h => h.usd),
        backgroundColor: COLORS.slice(0, priced.length),
        borderWidth: 1,
      },
    ],
  }

  const options = {
    plugins: {
      tooltip: {
        callbacks: {
          label: (ctx: any) => {
            const h = priced[ctx.dataIndex]
            return `${h.symbol}: ${h.amount.toFixed(4)} | $${h.usd.toFixed(2)} (${h.percent.toFixed(1)}%)`
          }
        }
      }
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: '0 auto' }}>
      <Pie data={chartData} options={options} />
      {unpriced.length > 0 && (
        <p style={{ fontSize: '0.8rem', marginTop: '0.5rem' }}>
          Unpriced tokens hidden: {unpriced.join(', ')}
        </p>
      )}
    </div>
  )
}

export default PortfolioChart 