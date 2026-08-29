import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../components/Icon'
import styles from './ToolDetailPage.module.css'

export default function MapPage() {
  const navigate = useNavigate()
  const [zoom, setZoom] = useState(1)

  return (
    <>
      <header className={styles.toolHead}>
        <button type="button" onClick={() => navigate('/tools')} aria-label="返回百宝箱"><Icon name="arrowLeft" /></button>
        <div><span>CAMPUS MAP</span><h1>校园地图</h1></div>
        <span className={styles.demoBadge}>示意占位</span>
      </header>
      <section className={styles.mapCard}>
        <div className={styles.mapToolbar}><div><strong>沈阳大学校园地图</strong><span>正式地图由后台替换</span></div><div><button type="button" aria-label="缩小地图" onClick={() => setZoom(Math.max(0, zoom - 1))}><Icon name="zoomOut" /></button><span>{zoom + 1}×</span><button type="button" aria-label="放大地图" onClick={() => setZoom(Math.min(2, zoom + 1))}><Icon name="zoomIn" /></button></div></div>
        <div className={`${styles.campusMap} ${styles[`mapZoom${zoom}`]}`} aria-label="校园地图示意图">
          <div className={styles.mapRoadA} />
          <div className={styles.mapRoadB} />
          <span className={`${styles.building} ${styles.buildingA}`}>图书馆</span>
          <span className={`${styles.building} ${styles.buildingB}`}>教学楼</span>
          <span className={`${styles.building} ${styles.buildingC}`}>体育馆</span>
          <span className={`${styles.building} ${styles.buildingD}`}>学生公寓</span>
          <span className={styles.mapGate}>南门</span>
        </div>
      </section>
      <div className={styles.infoBar}><Icon name="info" /><p><strong>首版仅提供地图图片查看</strong><span>暂不支持定位、路线规划或楼内导航。</span></p></div>
    </>
  )
}
