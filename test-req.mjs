const formData = new FormData();
formData.append('platform', 'Web App');
formData.append('requirement', 'A simple test requirement.');

fetch('http://localhost:3000/api/generate-tests', {
  method: 'POST',
  body: formData,
})
.then(async (res) => {
  console.log('Status:', res.status, res.statusText);
  const text = await res.text();
  console.log('Body:', text);
})
.catch(err => console.error('Fetch error:', err));
