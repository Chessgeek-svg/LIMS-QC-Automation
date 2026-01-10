import { LineChart, Line, XAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, YAxis} from 'recharts';

const QCChart = ({ data, stats }) => {
  if (!data || data.length === 0) return <p>No data available for this test.</p>;

  const chartData = data.map(r => ({
    ...r,
    displayDate: new Date(r.timestamp).toLocaleDateString(),
    value: parseFloat(r.value)
  }));
const CustomTooltip = ({ active, payload, label, stats }) => {
  if (active && payload && payload.length) {
    const value = payload[0].value;
    const mean = stats?.test_definition?.mean;
    const sd = stats?.test_definition?.std_dev;
    
    const zScore = mean && sd ? ((value - mean) / sd).toFixed(2) : "N/A";

    return (
      <div style={{ 
        backgroundColor: '#1e293b', 
        padding: '10px', 
        border: '1px solid #3b82f6', 
        borderRadius: '4px', 
        color: 'white',
        fontSize: '0.9rem'
      }}>
        <p style={{ margin: 0, fontWeight: 'bold', fontSize: '1.1rem' }}>
          Value: {value}
        </p>
        
        <p style={{ margin: '4px 0', color: Math.abs(zScore) > 2 ? '#f87171' : '#60a5fa' }}>
          Z-Score: {zScore}
        </p>
        
        <p style={{ margin: 0, color: '#94a3b8', fontSize: '0.8rem' }}>
          {new Date(label).toLocaleString()}
        </p>
      </div>
    );
  }
  return null;
};

  return (
    <div style={{ width: '100%', height: 400, marginTop: '20px', background: '#f8f9fa', padding: '10px', borderRadius: '8px' }}>
      <h4>Levey-Jennings Chart: {stats.test_definition.analyte_name}</h4>
      <ResponsiveContainer width="100%" height="90%">
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="timestamp" 
            tickFormatter={(tickItem) => {
              //Convert the raw ISO string back to a readable date for the axis label
              return new Date(tickItem).toLocaleDateString(); 
            }}
          />
          <YAxis domain={['auto', 'auto']} />
          <Tooltip content={<CustomTooltip stats={stats} />} />
          
          {/* Westgard Boundary Lines */}
          <ReferenceLine y={parseFloat(stats.test_definition.mean)} label="Mean" stroke="green" strokeWidth={2} />
          <ReferenceLine y={parseFloat(stats.test_definition.mean) + (parseFloat(stats.test_definition.std_dev) * 2)} label="+2SD" stroke="red" strokeDasharray="3 3" />
          <ReferenceLine y={parseFloat(stats.test_definition.mean) - (parseFloat(stats.test_definition.std_dev) * 2)} label="-2SD" stroke="red" strokeDasharray="3 3" />
          
          <Line 
            type="monotone" 
            dataKey="value" 
            stroke="#8884d8" 
            activeDot={{ r: 8 }}
            strokeWidth={3}
            dot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default QCChart;