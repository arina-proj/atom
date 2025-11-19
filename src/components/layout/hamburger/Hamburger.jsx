import { FaXmark } from 'react-icons/fa6'
import { FaBarsStaggered } from 'react-icons/fa6'
import useOnClickOutside from '../../../hooks/useOnClickOutside'
import styles from './Hamburger.module.scss'
import Menu from './Menu'

const Hamburger = () => {
	const { isShow, ref, setIsShow } = useOnClickOutside(false)

	return (
		<div className={styles.wrapper} ref={ref}>
			<button 
				className={styles.button}
				onClick={() => setIsShow(!isShow)}
			>
				{isShow ? (
					<FaXmark fontSize={24} fill="#fff" />
				) : (
					<FaBarsStaggered fontSize={24} fill="#fff" />
				)}
			</button>
			<Menu isShow={isShow} setIsShow={setIsShow}/>
		</div>
	)
}

export default Hamburger
