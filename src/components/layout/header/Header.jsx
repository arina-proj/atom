import { FaArrowLeft } from 'react-icons/fa6'
import { FaUser } from 'react-icons/fa6'
import { useLocation, useNavigate } from 'react-router-dom'



import Hamburger from '../hamburger/Hamburger'

import styles from './Header.module.scss'

const Header = ({ backLink = '/' }) => {
	const { pathname } = useLocation()
	const navigate = useNavigate()
	

	return (
		<header className={styles.header}>
  {pathname === '/' ? (
    // На главной - невидимая кнопка слева и гамбургер справа
    <>
      <button style={{ opacity: 0, pointerEvents: 'none' }}>
        <FaArrowLeft fill='#fff' fontSize={29} />
      </button>
      <Hamburger />
    </>
  ) : (
    // На других страницах - кнопка назад слева и гамбургер справа
    <>
      <button
        onClick={() => {
          navigate(-1)
        }}
      >
        <FaArrowLeft fill='#fff' fontSize={29} />
      </button>
      <Hamburger />
    </>
  )}
</header>
	)
}
export default Header
