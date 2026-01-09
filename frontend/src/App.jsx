import { useState, useEffect } from 'react'
import axios from 'axios'
import QCChart from './QCChart'

function App() {
  const [tests, setTests] = useState([])
  const [selectedStats, setSelectedStats] = useState(null)
  const [error, setError] = useState(null);
  const [selectedResult, setSelectedResult] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [selectedTestId, setSelectedTestId] = useState(null);
  const [supComment, setSupComment] = useState("");

  useEffect(() => {
    axios.get('http://localhost:8000/api/v1/test-definitions/')
      .then(res => setTests(res.data))
      .catch(err => setError("Could not load tests."));
  }, [])

const selectTest = (testId) => {
  setSelectedTestId(testId);
};

//Use an effect to fetch data whenever the test OR the checkbox changes
useEffect(() => {
  if (!selectedTestId) return;

  setError(null);
  //Pass the showArchived state to the backend as a query parameter
  axios.get(`http://localhost:8000/api/v1/test-definitions/${selectedTestId}/stats?include_archived=${showArchived}`)
    .then(res => {
      setSelectedStats(res.data);
    })
    .catch(err => {
      console.error("API Error:", err);
      setError(err.response?.status === 404 ? "No results found." : "Server error.");
    });
}, [selectedTestId, showArchived]); //Re-runs when either of these change
  const handleUpdateStatus = (newStatus) => {
    const payload = {
      status: newStatus,
      supervisor_comment: supComment,
      supervisor_id: 1 //Hardcoded for now until Auth added
    };

    axios.patch(`http://localhost:8000/api/v1/results/${selectedResult.id}`, payload)
      .then(res => {
        setSelectedStats(prevStats => {
          if (!prevStats) return null;
          
          const updatedResults = prevStats.recent_results.map(r => 
            r.id === selectedResult.id ? { ...r, status: newStatus } : r
          );

          return {
            ...prevStats,
            recent_results: updatedResults
          };
        });

        setSelectedResult(null);
        setSupComment("");
      })
      .catch(err => {
        console.error(err);
        alert("Failed to update result. Check console for details.");
      });
  };
  const displayedResults = selectedStats?.recent_results?.filter(r => {
    if (showArchived) return true;
    return r.status?.toUpperCase() !== 'ARCHIVED';
  }) || [];

  const calculateObservedStats = (results) => {
    const values = results
        .map(r => parseFloat(r.value))
        .filter(val => !isNaN(val)); //Remove any entries that aren't numbers

      const n = values.length;
    if (n === 0) return { mean: 0, stdDev: 0, cv: 0 };
    
    const mean = values.reduce((a, b) => a + b, 0) / n;

    const stdDev = n > 1 
      ? Math.sqrt(values.map(x => Math.pow(x - mean, 2)).reduce((a, b) => a + b) / n) 
      : 0;

    const cv = mean !== 0 ? (stdDev / mean) * 100 : 0;

    return { 
      mean: mean.toFixed(2), 
      stdDev: stdDev.toFixed(2), 
      cv: cv.toFixed(2) 
    };
  };

  const observed = calculateObservedStats(displayedResults);
  

  return (
    <div style={{ padding: '30px', maxWidth: '1000px', margin: '0 auto' }}>
      <h1>LIMS-QC Dashboard</h1>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        
        {tests.map(test => (
          <button 
            key={test.id} 
            onClick={() => selectTest(test.id)}
            style={{ padding: '10px 20px', cursor: 'pointer', borderRadius: '5px', border: '1px solid #ccc' }}
          >
            {test.analyte_name}
          </button>
        ))}
      </div>
      {error && (
        <div style={{ backgroundColor: '#fee2e222', color: '#b91c1c', padding: '10px', borderRadius: '5px', marginBottom: '15px' }}>
          {error}
        </div>
      )}
      
      {selectedStats ? (
          <QCChart data={displayedResults} stats={selectedStats} onPointClick={setSelectedResult}/>
      ) : (
        !error && <p>Please select a test to view the QC chart.</p>
      )}
      {selectedStats && (
        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(4, 1fr)', 
          gap: '15px', 
          marginBottom: '25px',
          backgroundColor: '#1e293b', 
          padding: '20px', 
          borderRadius: '8px', 
          color: 'white',
          border: '1px solid #334155'
        }}>
        <div>
          <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: '0' }}>Mean (Target | Obs)</p>
          <p style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: '5px 0' }}>
            {selectedStats.test_definition?.mean} | <span style={{ color: '#60a5fa' }}>{observed.mean}</span>
          </p>
        </div>

        <div>
          <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: '0' }}>SD (Target | Obs)</p>
          <p style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: '5px 0' }}>
            {selectedStats.test_definition?.std_dev} | <span style={{ color: '#60a5fa' }}>{observed.stdDev}</span>
          </p>
        </div>

        <div>
          <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: '0' }}>CV% (Target | Obs)</p>
          <p style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: '5px 0' }}>
            {((selectedStats.test_definition?.std_dev / selectedStats.test_definition?.mean) * 100).toFixed(2)}% | 
            <span style={{ color: '#60a5fa' }}> {observed.cv}%</span>
          </p>
        </div>
          <div style={{ borderLeft: '1px solid #334155', paddingLeft: '15px' }}>
            <p style={{ fontSize: '0.7rem', color: '#94a3b8', margin: '0' }}>Points (N)</p>
            <p style={{ fontSize: '1.1rem', fontWeight: 'bold', margin: '5px 0' }}>{displayedResults.length}</p>
          </div>
        </div>
      )}
      {selectedStats && (
        <div style={{ marginTop: '30px' }}>
          <h3>Data Review Queue</h3>
          <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <input 
          type="checkbox" 
          id="showArchived" 
          checked={showArchived} 
          onChange={() => setShowArchived(!showArchived)} 
        />
        <label htmlFor="showArchived" style={{ fontSize: '0.9rem', color: '#4b5563' }}>
          Show Archived Results
        </label>
      </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#1f4aa1ff', borderBottom: '2px solid #e5e7eb' }}>
                <th style={{ padding: '12px' }}>Timestamp</th>
                <th style={{ padding: '12px' }}>Value</th>
                <th style={{ padding: '12px' }}>Status</th>
                <th style={{ padding: '12px' }}>Supervisor Comment</th>
              </tr>
            </thead>
            <tbody>
              {displayedResults.map((result) => (
                <tr key={result.id} style={{ borderBottom: '1px solid #e5e7eb' }}>
                  <td style={{ padding: '12px' }}>
                    {new Date(result.timestamp).toLocaleString()}
                  </td>
                  <td style={{ padding: '12px', fontWeight: 'bold' }}>
                    {result.value}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '0.85rem',
                      fontWeight: 'bold',
                      backgroundColor: 
                        result.status === 'PASS' ? '#dcfce7' : 
                        result.status === 'VERIFIED' ? '#dbeafe' :
                        result.status === 'ARCHIVED' ? '#f3f4f6' :
                        '#fee2e2',
                      color: 
                        result.status === 'PASS' ? '#166534' : 
                        result.status === 'VERIFIED' ? '#1e40af' : 
                        result.status === 'ARCHIVED' ? '#374151' : 
                        '#991b1b'
                    }}>
                      {result.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    <button 
                      onClick={() => {
                        setSelectedResult(result);
                        setSupComment("");
                      }}
                      style={{ padding: '5px 10px', cursor: 'pointer', backgroundColor: '#3b82f6', color: 'white', border: 'none', borderRadius: '4px' }}>
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {selectedResult && (
            <div className="review-panel" style={{ marginTop: '20px', padding: '20px', border: '2px solid #3b82f6', borderRadius: '8px', backgroundColor: '#060a10ff' }}>
              <h3>Reviewing Result ID: {selectedResult.id}</h3>
              <p><strong>Value:</strong> {selectedResult.value} | <strong>Current Status:</strong> {selectedResult.status}</p>
              <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#1e293b', borderRadius: '4px' }}>
                <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: '0 0 5px 0' }}>Tech Note (Immutable):</p>
                <p style={{ margin: 0 }}>{selectedResult.user_comment || "No comment provided by tech."}</p>
              </div>
              

              <label style={{ display: 'block', marginBottom: '10px' }}>
                Supervisor Comment:
                <textarea 
                  style={{ width: '100%', height: '80px', marginTop: '5px', padding: '10px' }}
                  value={supComment}
                  onChange={(e) => setSupComment(e.target.value)}
                  placeholder="Enter justification for verification or archival..."
                />
              </label>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button 
                  onClick={() => handleUpdateStatus('VERIFIED')}
                  style={{ padding: '10px 20px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
                >
                  Verify & Pass
                </button>
                
                <button 
                  onClick={() => handleUpdateStatus('ARCHIVED')}
                  style={{ padding: '10px 20px', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
                >
                  Archive (Soft Delete)
                </button>

                <button 
                  onClick={() => setSelectedResult(null)}
                  style={{ padding: '10px 20px', backgroundColor: '#6b7280', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default App