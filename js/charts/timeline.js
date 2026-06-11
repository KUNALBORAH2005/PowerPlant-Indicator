// ============================================================
// Forecast Timeline Chart (Canvas-based)
// ============================================================

export class TimelineChart {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.opts = {
      paddingTop: 20,
      paddingRight: 20,
      paddingBottom: 40,
      paddingLeft: 60,
      gridLines: 5,
      font: "12px 'Inter', sans-serif",
      monoFont: "11px 'JetBrains Mono', monospace",
      accentBlue: '#3b82f6',
      accentCyan: '#06b6d4',
      red: '#ef4444',
      yellow: '#f59e0b',
      orange: '#f97316',
      textSecondary: '#94a3b8',
      textMuted: '#475569',
      gridColor: 'rgba(255,255,255,0.05)',
      ...opts,
    };
    this.dpr = window.devicePixelRatio || 1;
    this._setupCanvas();
  }

  _setupCanvas() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    const w = Math.max(300, rect.width || 600);
    const h = this.canvas.height || 260;
    this.canvas.width = w * this.dpr;
    this.canvas.height = h * this.dpr;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx.scale(this.dpr, this.dpr);
    this.W = w;
    this.H = h;
  }

  render(historical, forecast, upperBand, lowerBand, oemLimit, opts = {}) {
    this._setupCanvas();
    const ctx = this.ctx;
    const { W, H } = this;
    const { paddingTop: pt, paddingRight: pr, paddingBottom: pb, paddingLeft: pl } = this.opts;
    const chartW = W - pl - pr;
    const chartH = H - pt - pb;

    const allValues = [
      ...historical,
      ...(forecast || []),
      ...(upperBand || []),
      ...(lowerBand || []),
      oemLimit != null ? oemLimit * 1.05 : 0,
    ].filter(isFinite);

    const minVal = Math.min(...allValues) * 0.97;
    const maxVal = Math.max(...allValues) * 1.03;
    const range = maxVal - minVal || 1;

    const totalPoints = (historical?.length || 0) + (forecast?.length || 0);
    const histCount = historical?.length || 0;

    const toX = (i) => pl + (i / Math.max(1, totalPoints - 1)) * chartW;
    const toY = (v) => pt + chartH - ((v - minVal) / range) * chartH;

    // Clear
    ctx.clearRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = this.opts.gridColor;
    ctx.lineWidth = 1;
    for (let i = 0; i <= this.opts.gridLines; i++) {
      const y = pt + (i / this.opts.gridLines) * chartH;
      const val = maxVal - (i / this.opts.gridLines) * range;
      ctx.beginPath();
      ctx.moveTo(pl, y);
      ctx.lineTo(W - pr, y);
      ctx.stroke();
      ctx.fillStyle = this.opts.textMuted;
      ctx.font = this.opts.monoFont;
      ctx.textAlign = 'right';
      ctx.fillText(val.toFixed(opts.decimals ?? 1), pl - 6, y + 4);
    }

    // OEM Limit line
    if (oemLimit != null) {
      const oemY = toY(oemLimit);
      ctx.strokeStyle = this.opts.red;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(pl, oemY);
      ctx.lineTo(W - pr, oemY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = this.opts.red;
      ctx.font = this.opts.font;
      ctx.textAlign = 'left';
      ctx.fillText(`OEM Limit: ${oemLimit}${opts.unit || ''}`, pl + 4, oemY - 5);

      // Warning zone (80%)
      const warnY = toY(oemLimit * 0.8);
      ctx.strokeStyle = this.opts.yellow;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 6]);
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      ctx.moveTo(pl, warnY);
      ctx.lineTo(W - pr, warnY);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.setLineDash([]);
    }

    // Confidence band (forecast)
    if (upperBand && lowerBand && forecast) {
      ctx.beginPath();
      const bandStart = histCount - 1;
      ctx.moveTo(toX(bandStart), toY(upperBand[0]));
      for (let i = 0; i < forecast.length; i++) {
        ctx.lineTo(toX(bandStart + i), toY(upperBand[i]));
      }
      for (let i = forecast.length - 1; i >= 0; i--) {
        ctx.lineTo(toX(bandStart + i), toY(lowerBand[i]));
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(59,130,246,0.08)';
      ctx.fill();
    }

    // Forecast line
    if (forecast && forecast.length > 0) {
      ctx.beginPath();
      ctx.moveTo(toX(histCount - 1), toY(historical.at(-1)));
      forecast.forEach((v, i) => ctx.lineTo(toX(histCount + i), toY(v)));
      ctx.strokeStyle = this.opts.accentBlue;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Historical line
    if (historical && historical.length > 0) {
      const grad = ctx.createLinearGradient(pl, 0, pl + chartW, 0);
      grad.addColorStop(0, this.opts.accentCyan);
      grad.addColorStop(1, this.opts.accentBlue);
      ctx.beginPath();
      ctx.moveTo(toX(0), toY(historical[0]));
      historical.forEach((v, i) => ctx.lineTo(toX(i), toY(v)));
      ctx.strokeStyle = grad;
      ctx.lineWidth = 2.5;
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    // Divider line between historical and forecast
    if (histCount > 0) {
      const divX = toX(histCount - 1);
      ctx.strokeStyle = 'rgba(255,255,255,0.15)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(divX, pt);
      ctx.lineTo(divX, pt + chartH);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = this.opts.textMuted;
      ctx.font = this.opts.font;
      ctx.textAlign = 'center';
      ctx.fillText('Now', divX, pt + chartH + 16);
    }

    // X-axis labels
    const xLabels = opts.xLabels || [];
    if (xLabels.length > 0) {
      ctx.fillStyle = this.opts.textMuted;
      ctx.font = this.opts.font;
      ctx.textAlign = 'center';
      xLabels.forEach(({ index, label }) => {
        ctx.fillText(label, toX(index), H - 6);
      });
    }
  }
}
