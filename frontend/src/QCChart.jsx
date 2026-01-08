import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, YAxis as YAxisRecharts } from 'recharts';

const QCChart = ({ data, stats }) => {
  if (!data || data.length === 0) return <p>No data available for this test.</p>;

  //Formatting data for the chart
  const chartData = data.map(r => ({
    ...r,
    displayDate: new Date(r.timestamp).toLocaleDateString(),
    value: parseFloat(r.value)
  }));

  return (
    <div style={{ width: '100%', height: 400, marginTop: '20px', background: '#f8f9fa', padding: '10px', borderRadius: '8px' }}>
      <h4>Levey-Jennings Chart: {stats.test_definition.analyte_name}</h4>
      <ResponsiveContainer width="100%" height="90%">
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="displayDate" />
          <YAxis domain={[stats.minus_3sd - 2, stats.plus_3sd + 2]} />
          <Tooltip />
          
          {/* Westgard Boundary Lines */}
          <ReferenceLine y={stats.target_mean} label="Mean" stroke="green" strokeWidth={2} />
          <ReferenceLine y={stats.plus_3sd} label="+3SD" stroke="red" strokeDasharray="3 3" />
          <ReferenceLine y={stats.minus_3sd} label="-3SD" stroke="red" strokeDasharray="3 3" />
          
          <Line type="monotone" dataKey="value" stroke="#8884d8" strokeWidth={3} dot={{ r: 6 }} activeDot={{ r: 8 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default QCChart;