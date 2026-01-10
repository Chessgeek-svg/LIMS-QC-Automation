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
  const [reviewComment, setreviewComment] = useState("");
  const [activeUser, setActiveUser] = useState({ id: 1, name: "Richard", role: "tech" });
  const [isEditingTargets, setIsEditingTargets] = useState(false);
  const [editForm, setEditForm] = useState({ mean: '', std_dev: '' });

  useEffect(() => {
    axios.get('http://localhost:8000/api/v1/test-definitions/')
      .then(res => setTests(res.data))
      .catch(err => {
        console.error("Backend Error:", err);
        setError(`Network Error: ${err.response?.status || "Server Offline"}`);
      });
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

useEffect(() => {
  //If the test definition ID changes, close all sensitive menus
  setIsEditingTargets(false);
  setSelectedResult(null); 
  setreviewComment(""); //Clear any drafted comments too
  
}, [selectedStats?.test_definition?.id]);

const handleUpdateStatus = (newStatus) => {
  if (!reviewComment || reviewComment.trim().length < 5) {
    alert("Regulatory Requirement: Please enter a review comment (minimum 5 characters) to justify this action.");
    return;
  }
  const payload = {
    status: newStatus,
    review_comment: reviewComment,
    reviewer_id: activeUser.id,
    reviewed_by_name: activeUser.name
  };

  axios.patch(`http://localhost:8000/api/v1/results/${selectedResult.id}`, payload)
    .then(res => {
      setSelectedStats(prevStats => {
        if (!prevStats) return null;
        
        const updatedResults = prevStats.recent_results.map(r => 
          r.id === selectedResult.id ? res.data : r
        );

        return {
          ...prevStats,
          recent_results: updatedResults
        };
      });

      setSelectedResult(null);
      setreviewComment("");
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

const handleOpenEdit = () => {
  setEditForm({
    mean: selectedStats.test_definition.mean,
    std_dev: selectedStats.test_definition.std_dev
  });
  setIsEditingTargets(true);
};

const saveTargetUpdates = () => {
  if (editForm.mean <= 0 || editForm.std_dev <= 0) {
    alert("Target Mean and SD must be positive values.");
    return;
  }

  const testId = selectedStats.test_definition.id;
  
  axios.patch(`http://localhost:8000/api/v1/test-definitions/${testId}`, editForm, {
    headers: { 'X-User-ID': activeUser.id } //Sends the ID of whoever is selected in the switcher
  })
    .then(res => {
    //Update local state so UI reflects new targets immediately
    setSelectedStats(prev => ({
      ...prev,
      test_definition: res.data
    }));
    setIsEditingTargets(false);
    alert("Target values updated successfully.");
  })
  .catch(err => {
    if (err.response?.status === 403) {
      alert("Access Denied: Your current role (Tech) cannot modify targets.");
    }
    else 
    console.error(err);
    alert("Error updating targets. Check console.");
  });
};
const RoleSwitcher = () => (
  <div style={{ position: 'fixed', top: 10, right: 10, background: '#1e293b', padding: '10px', borderRadius: '8px', border: '1px solid #3b82f6', zIndex: 1000 }}>
    <p style={{ margin: '0 0 5px 0', fontSize: '0.7rem', color: '#94a3b8' }}>Active Session:</p>
    <select 
      value={activeUser.id} 
      onChange={(e) => {
        const val = parseInt(e.target.value);
        // Toggle logic: swap between seeded users
        if (val === 1) setActiveUser({ id: 1, name: "Richard", role: "tech" });
        else setActiveUser({ id: 2, name: "Supervisor", role: "supervisor" });
      }}
      style={{ background: '#0f172a', color: 'white', border: 'none' }}
    >
      <option value={1}>Richard (Tech)</option>
      <option value={2}>Lab Manager (Supervisor)</option>
    </select>
  </div>
);

  return (
    <div style={{ padding: '30px', maxWidth: '1000px', margin: '0 auto' }}>
      <RoleSwitcher />
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
      <div style={{ marginBottom: '10px', paddingLeft: '10px' }}>
        <h2 style={{ color: '#60a5fa', margin: 0 }}>
          {selectedStats?.test_definition?.analyte_name || "Select a Test"}
        </h2>
        <p style={{ fontSize: '0.8rem', color: '#94a3b8', margin: 0 }}>
          Data Review Dashboard
        </p>
      </div>
      {selectedStats ? (
          <QCChart data={displayedResults} stats={selectedStats} onPointClick={setSelectedResult}/>
      ) : (
        !error && <p>Please select a test to view the QC chart.</p>
      )}
      {selectedStats && (
        <>
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
          <div>
            {activeUser.role === 'supervisor' && (
              <button
                onClick={() => {
                  setEditForm({
                    mean: selectedStats.test_definition.mean,
                    std_dev: selectedStats.test_definition.std_dev
                  });
                  setIsEditingTargets(true);
                }} 
                style={{ fontSize: '0.7rem' }}
              >
                Edit Target Mean/SD
              </button>
            )}
            {isEditingTargets && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Target Mean</label>
                <input 
                  type="number" 
                  value={editForm.mean}
                  onChange={(e) => setEditForm({...editForm, mean: parseFloat(e.target.value)})}
                  style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #3b82f6', color: 'white' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '0.7rem', color: '#94a3b8' }}>Target SD</label>
                <input 
                  type="number" 
                  value={editForm.std_dev}
                  onChange={(e) => setEditForm({...editForm, std_dev: parseFloat(e.target.value)})}
                  style={{ width: '100%', padding: '8px', background: '#0f172a', border: '1px solid #3b82f6', color: 'white' }}
                />
              </div>
              <div style={{ gridColumn: 'span 2', display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button onClick={saveTargetUpdates} style={{ flex: 1, backgroundColor: '#3b82f6' }}>Save</button>
                <button onClick={() => setIsEditingTargets(false)} style={{ flex: 1, backgroundColor: '#475569' }}>Cancel</button>
              </div>
            </div>)}
          </div>
        </>
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
                <th style={{ padding: '12px' }}>Reviewed By</th>
                <th style={{ padding: '12px' }}>Review Comment</th>
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
                        result.status === 'ARCHIVED' ? '#fee2e2' :
                        '#9d9d9dff',
                      color: 
                        result.status === 'PASS' ? '#166534' : 
                        result.status === 'VERIFIED' ? '#1e40af' : 
                        result.status === 'ARCHIVED' ? '#991b1b' : 
                        '#363636ff'
                    }}>
                      {result.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px', fontSize: '0.85rem' }}>
                    {result.reviewed_by_name || "—"}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <button 
                      onClick={() => {
                        setSelectedResult(result);
                        setreviewComment("");
                      }}

                      disabled={activeUser.role === 'tech' && (result.status === 'VERIFIED' || result.status === 'ARCHIVED')}
                      style={{ 
                        padding: '5px 10px', 
                        cursor: (activeUser.role === 'tech' && (result.status === 'VERIFIED' || result.status === 'ARCHIVED')) ? 'not-allowed' : 'pointer', 
                        backgroundColor: (activeUser.role === 'tech' && (result.status === 'VERIFIED' || result.status === 'ARCHIVED')) ? '#475569' : '#3b82f6', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '4px',
                        opacity: (activeUser.role === 'tech' && (result.status === 'VERIFIED' || result.status === 'ARCHIVED')) ? 0.5 : 1
                      }}
                    >
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
                Review Comment:
                <textarea 
                  style={{ width: '100%', height: '80px', marginTop: '5px', padding: '10px' }}
                  value={reviewComment}
                  onChange={(e) => setreviewComment(e.target.value)}
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