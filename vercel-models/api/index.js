export default function handler(req, res) {
  res.status(200).json({
    message: 'TFT and N-HITS Models API',
    endpoints: {
      tft: '/api/predict-tft',
      nhits: '/api/predict-nhits',
      health: '/api/health'
    },
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
}