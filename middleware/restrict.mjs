export const restrict = (req, res, next) => {
    if (!req.session) {
        res.redirect('/login');
    } else if (req.session.user) {
        next();
    } else {
        req.session.error = 'Access denied!';
        res.redirect('/login');
    }
}