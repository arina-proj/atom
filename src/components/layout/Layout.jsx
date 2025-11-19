import styles from './Layout.module.scss'
import Header from './header/Header'

const Layout = ({ children }) => {
  return (
    <section className={styles.wrapper}>
      <Header />
      {children}
    </section>
  )
}

export default Layout
